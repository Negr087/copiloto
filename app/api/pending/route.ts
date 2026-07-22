import { NextResponse } from "next/server";
import { decidir } from "@/daemon/pending";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { id, aprobado } = (await req.json()) as { id: string; aprobado: boolean };
    if (!id) return NextResponse.json({ ok: false }, { status: 400 });

    decidir(id, Boolean(aprobado));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
