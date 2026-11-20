import { AUTH_COOKIE, AUTH_MAX_AGE, checkPassword, isMisconfigured, lockEnabled, sessionToken } from "@/lib/auth";

/** POST { password } → sets the unlock cookie. DELETE → locks this device again. */
export async function POST(req: Request) {
  if (isMisconfigured()) {
    return Response.json({ ok: false, error: "devbot isn't set up yet: add DEVBOT_PASSWORD in your hosting settings and redeploy." }, { status: 503 });
  }
  if (!lockEnabled()) return Response.json({ ok: true });

  let password = "";
  try {
    password = String(((await req.json()) as { password?: unknown }).password ?? "");
  } catch {}

  if (!checkPassword(password)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 1000));
    return Response.json({ ok: false, error: "Wrong password." }, { status: 401 });
  }

  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${AUTH_COOKIE}=${sessionToken()}; Path=/; Max-Age=${AUTH_MAX_AGE}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return res;
}

export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${AUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return res;
}
