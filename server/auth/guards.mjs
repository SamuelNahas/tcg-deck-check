export function createGuards({ store, sessions }) {
  function requireAuth(request, response, next) {
    const token = sessions.readToken(request);
    if (!token) return response.status(401).json({ error: "Sessão expirada. Entre novamente.", code: "session_expired" });
    const user = token.role === "judge" ? store.getJudge(token.userId) : store.getPlayerAccount(token.userId);
    if (!user) return response.status(401).json({ error: "Conta não encontrada.", code: "account_not_found" });
    request.auth = { role: token.role, user };
    next();
  }

  function requireRole(role) {
    return (request, response, next) => {
      if (request.auth?.role !== role) return response.status(403).json({ error: "Acesso não permitido para este perfil.", code: "forbidden_role" });
      next();
    };
  }

  return { requireAuth, requireRole };
}
