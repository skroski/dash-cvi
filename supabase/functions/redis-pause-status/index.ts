// Compatibilidade temporária: as pausas migraram do Redis para Postgres.
// O painel atual usa `atendimento-controle`, que exige autenticação de usuário.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ success: false, error: 'deprecated_use_atendimento_controle' }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 410 }
  );
});
