-- Regra "Conscientização de vacinação": o fluxo n8n LembretesVacinas, já como
-- dado do módulo. Aplique DEPOIS do 02_lembretes_envio_supabase.sql.
--
-- O que o fluxo original fazia e como ficou aqui:
--   Schedule 20h                      -> horario_envio = 20:00 (fuso da regra)
--   Data Agendada = hoje              -> dias_antecedencia = 0
--   Status = CONFIRMADO               -> somente_confirmados = true
--   telefone único por dia            -> garantido pelo módulo (1 por tutor/dia)
--   Wait 20-50 s entre envios         -> intervalo_min/max_segundos = 20/50
--   gpt-4.1-mini + 5 exemplos         -> usar_ia, modelo_ia e exemplos
--   atende só a aba "Vacinas"         -> servico_ids = [serviço "Vacina"]
--
-- O envio continua desligado enquanto a chave geral "Envio automático"
-- (lembrete_ajustes.envio_automatico) estiver desligada.
--
-- Opcional: o texto original citava um caso de raiva registrado em Brasília.
-- É um fato datado e local, então NÃO vem no padrão. Se a clínica quiser, acrescente
-- em "Instruções extras" da regra, pelo painel, uma frase como:
--   "Mencione que o registro de um caso de raiva na região reforça a importância
--    da vacinação. Não atribua uma data específica ao caso."

insert into public.lembrete_servicos (nome, cor, ordem)
values ('Vacina', 'ambar', 40)
on conflict (nome_normalizado) do nothing;

insert into public.lembrete_configuracoes (
  nome,
  ativo,
  dias_antecedencia,
  horario_envio,
  timezone,
  mensagem_template,
  exemplos,
  usar_ia,
  modelo_ia,
  instrucoes_ia,
  servico_ids,
  intervalo_min_segundos,
  intervalo_max_segundos,
  janela_envio_horas,
  somente_confirmados
)
values (
  'Conscientização de vacinação',
  true,
  0,
  '20:00',
  'America/Sao_Paulo',
  '',
  array[
    E'Olá, {{nome_tutor}}! 🐾\n\nA equipe da {{clinica}} tem um lembrete importante: manter a vacinação em dia é uma forma de cuidar de quem faz parte da sua família.\n\nA vacinação ajuda a prevenir doenças e a proteger tanto os pets quanto as pessoas que convivem com eles. 💉\n\nVocê sabe se as vacinas do seu pet estão atualizadas?\n\nSe estiver com dúvida, envie uma foto da carteirinha por aqui. Nossa equipe pode conferir o histórico e verificar se há alguma vacina pendente ou reforço necessário.\n\nConte com a {{clinica}} para ajudar nesse cuidado! ❤️',
    E'Oi, {{nome_tutor}}! 🐶🐱\n\nPassando com um cuidado importante da {{clinica}}: a vacinação do seu pet merece atenção durante todo o ano.\n\nVacinar é um gesto de prevenção e carinho com o seu pet e com a sua família.\n\nComo está a carteirinha de vacinação dele? 📋\n\nSe precisar de ajuda para conferir, mande uma foto por esta conversa. Nossa equipe vai avaliar os registros e orientar sobre possíveis vacinas pendentes ou reforços.\n\nEstamos por aqui para ajudar você a cuidar de quem tanto ama! ❤️',
    E'Olá, {{nome_tutor}}! Aqui é a equipe da {{clinica}}. 🐾\n\nEntre tantos cuidados do dia a dia, vale reservar um momento para olhar a carteirinha de vacinação do seu pet.\n\nManter as vacinas atualizadas ajuda a proteger a saúde dos animais e de toda a família. 💉\n\nAs vacinas do seu pet estão em dia?\n\nNa dúvida, envie uma foto da carteirinha por aqui. Nossa equipe pode analisar o histórico e conferir se alguma dose ou reforço precisa ser atualizado.\n\nCuidar da prevenção também é demonstrar amor! ❤️',
    E'Oi, {{nome_tutor}}! A {{clinica}} tem um lembrete para você. 🐾\n\nA saúde do seu pet também depende da prevenção. Manter a vacinação sempre atualizada ajuda a proteger cães, gatos e as famílias que convivem com eles. 💉\n\nVocê já conferiu se existe alguma vacina ou reforço pendente na carteirinha do seu pet?\n\nSe não tiver certeza, pode mandar uma foto por aqui. Nossa equipe confere os registros e ajuda você a entender o que precisa de atenção.\n\nEnvie a carteirinha e conte com a gente nesse cuidado! ❤️',
    E'Olá, {{nome_tutor}}! 🐶🐱\n\nA {{clinica}} quer ajudar você a manter os cuidados com o seu pet em dia, começando pela vacinação.\n\nAs vacinas ajudam a proteger nossos animais contra doenças e contribuem para a proteção da família.\n\nVocê sabe se está tudo certo com a vacinação do seu pet? 📋\n\nSe tiver alguma dúvida, envie uma foto da carteirinha nesta conversa. Nossa equipe pode verificar o histórico e orientar sobre vacinas que estejam pendentes ou precisem de reforço.\n\nUm cuidado hoje faz parte de uma vida com mais saúde e carinho. Conte com a {{clinica}}! ❤️'
  ]::text[],
  true,
  'gpt-4.1-mini',
  E'Esta é uma mensagem de conscientização sobre vacinação, enviada no dia do atendimento. Além de citar o atendimento de hoje, convide o tutor a enviar uma foto da carteirinha de vacinação por esta conversa, para a equipe verificar possíveis pendências ou reforços.\nPergunte se as vacinas estão em dia, sem presumir que estejam atrasadas.\nReforce que a vacinação protege o pet e também a família.\nNão inclua pesquisa de satisfação.',
  array(select s.id from public.lembrete_servicos s where s.nome_normalizado = 'vacina'),
  20,
  50,
  3,
  true
)
on conflict (nome) do nothing;
