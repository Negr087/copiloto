import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { run } from "./shell";

/**
 * Puente WSL -> portapapeles de Windows.
 *
 * En WSL no hay portapapeles propio, pero si hay interop: podemos ejecutar
 * powershell.exe desde Linux. Windows ademas expone
 * GetClipboardSequenceNumber(), un contador que se incrementa en CADA copiado
 * aunque el contenido sea identico. Eso resuelve el doble Ctrl+C mejor que
 * el watcher de Wayland: no inferimos el evento, lo leemos.
 */

/** Estamos adentro de WSL? */
export function isWSL(): boolean {
  if (process.env.WSL_DISTRO_NAME) return true;
  try {
    return fs.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

/**
 * PowerShell acepta el script en base64 UTF-16LE. Lo usamos para no pelear
 * con el escapado entre bash, WSL y PowerShell: es la unica forma realmente
 * confiable de pasar texto arbitrario.
 */
function encodeCommand(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

const NORMALIZAR = (s: string) => s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

/** Lectura puntual del portapapeles de Windows. */
export async function readWin(): Promise<string | null> {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $t = Get-Clipboard -Raw
    if ($null -eq $t) { exit 0 }
    [Console]::Out.Write([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($t)))
  `;

  const { stdout, code } = await run("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-EncodedCommand", encodeCommand(script),
  ]);

  if (code !== 0 || !stdout.trim()) return null;

  try {
    return NORMALIZAR(Buffer.from(stdout.trim(), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/** Escritura al portapapeles de Windows, sin tocar el texto. */
export async function writeWin(texto: string): Promise<boolean> {
  const b64 = Buffer.from(texto, "utf8").toString("base64");
  const script = `
    $b = '${b64}'
    $t = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b))
    Set-Clipboard -Value $t
  `;

  const { code } = await run("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-EncodedCommand", encodeCommand(script),
  ]);

  return code === 0;
}

export interface WinCopyEvent {
  seq: number;
  texto: string;
  /** El origen marco el contenido como excluido del historial: es un secreto. */
  secreto: boolean;
}

/**
 * El script que corre del lado de Windows.
 *
 * Arranca UNA vez y se queda vivo. Spawnear powershell.exe en cada poll
 * costaria ~300ms y CPU constante; asi el costo es una sola vez.
 *
 * Los gestores de contrasenas de Windows (KeePass, 1Password, Bitwarden)
 * marcan lo que copian con formatos como "ExcludeClipboardContentFromMonitor
 * ProcessingCollection" o "Clipboard Viewer Ignore". Si aparece alguno,
 * mandamos secreto=true y no incluimos el contenido.
 */
const WATCH_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ClipSeq {
  [DllImport("user32.dll")]
  public static extern uint GetClipboardSequenceNumber();
}
"@

Add-Type -AssemblyName System.Windows.Forms

$marcasSecretas = @(
  'ExcludeClipboardContentFromMonitorProcessing',
  'CanIncludeInClipboardHistory',
  'Clipboard Viewer Ignore'
)

$ultima = 0

while ($true) {
  $seq = [ClipSeq]::GetClipboardSequenceNumber()

  if ($seq -ne $ultima) {
    $ultima = $seq
    $secreto = $false

    try {
      $datos = [System.Windows.Forms.Clipboard]::GetDataObject()
      if ($datos) {
        foreach ($m in $marcasSecretas) {
          if ($datos.GetDataPresent($m)) { $secreto = $true; break }
        }
      }
    } catch { }

    $b64 = ''
    if (-not $secreto) {
      $t = Get-Clipboard -Raw
      if ($t) { $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($t)) }
    }

    $linea = '{"seq":' + $seq + ',"secreto":' + $secreto.ToString().ToLower() + ',"b64":"' + $b64 + '"}'
    [Console]::Out.WriteLine($linea)
    [Console]::Out.Flush()
  }

  Start-Sleep -Milliseconds 200
}
`;

export class WinClipboardWatcher extends EventEmitter {
  private proc: ChildProcess | null = null;
  private buffer = "";

  start(): boolean {
    this.proc = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-EncodedCommand", encodeCommand(WATCH_SCRIPT)],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    this.proc.stdout?.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lineas = this.buffer.split("\n");
      // La ultima puede estar incompleta: la dejamos para la proxima vuelta.
      this.buffer = lineas.pop() ?? "";

      for (const linea of lineas) {
        const limpia = linea.trim();
        if (!limpia.startsWith("{")) continue;

        try {
          const ev = JSON.parse(limpia) as { seq: number; secreto: boolean; b64: string };
          this.emit("copy", {
            seq: ev.seq,
            secreto: ev.secreto,
            texto: ev.b64
              ? NORMALIZAR(Buffer.from(ev.b64, "base64").toString("utf8"))
              : "",
          } satisfies WinCopyEvent);
        } catch {
          // linea corrupta, seguimos
        }
      }
    });

    this.proc.on("error", () => this.emit("unavailable"));
    this.proc.on("close", () => this.emit("unavailable"));

    return true;
  }

  stop() {
    this.proc?.kill();
    this.proc = null;
  }
}
