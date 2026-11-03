# Cobertura do prompt do n8n (agente de atendimento da clínica de origem)

Cada item do prompt original tem um destino abaixo. Os códigos entre crases são regras de **Meu Prompt** (`prompt_regras`):
as genéricas vêm da migração `20261027100000`; as que começam com `vb_` (e a `sintomas_graves_emergencia` reescrita) vêm de `supabase/seeds/clinica-vetbots.sql`.
O teste `supabase/tests/clinica/cobertura.test.mjs` garante que as 94 regras estão na tabela e que todo código citado existe.

## Regras essenciais (1–94)

| # | Destino | Tipo | Observação |
|---|---|---|---|
| 1 | `saudacao_inicial`; config Saudação/aviso fora do expediente | regra + config |  |
| 2 | `coleta_uma_por_vez` | regra |  |
| 3 | `identidade_e_objetivo` | regra |  |
| 4 | `coleta_uma_por_vez` | regra |  |
| 5 | `ferramentas_disponiveis`; ferramenta `grava_info` (worker) | regra + ferramenta | `grava_info` não existia no destino: agora grava só nome, nome_pet, porte_pet, raca_pet, email e servico. |
| 6 | (descartada) | descartada | Contradiz o próprio prompt ("se o cliente informar só a data, NÃO pergunte a hora"). Vale a regra de `consulta_disponibilidade_agenda`: mostrar os horários do dia. **Decisão registrada.** |
| 7 | `vb_conversa_sempre_com_pergunta` | regra |  |
| 8 | `vb_exames_requisicao`; `vb_fluxo_exames` | regra |  |
| 9 | `vb_profilaxia_dentaria` | regra |  |
| 10 | `servicos_e_valores`; formatação de moeda no código | regra + código |  |
| 11 | `vb_sem_link_meet` | regra |  |
| 12 | `reagendamento_cancelamento`; parâmetros `date_start` / `data_antiga` da ferramenta | regra + ferramenta |  |
| 13 | `coleta_dados_agendamento`; dado obrigatório `email` do tipo | regra + motor | A ferramenta recusa agendar/remarcar/cancelar sem e-mail válido quando o tipo o exige. |
| 14 | `comunicacao_sem_termos_tecnicos` | regra |  |
| 15 | `vb_fluxo_clinica_geral`; `vb_fluxo_exames`; `vb_fluxo_vacinas` | regra |  |
| 16 | `coleta_dados_agendamento`; contexto "Cliente/Pet" do prompt | regra + variáveis |  |
| 17 | `coleta_dados_agendamento`; contexto "Cliente/Pet" do prompt | regra + variáveis |  |
| 18 | `vb_conversa_sempre_com_pergunta` | regra |  |
| 19 | `encaminhamento_humano` | regra |  |
| 20 | `vb_emoji_calendario` | regra |  |
| 21 | `formatacao_whatsapp`; divisão em mensagens no worker | regra + código | Substitui o "Parser Chain" (LLM) por formatação e divisão determinísticas. |
| 22 | `vb_internacao_uti`; serviço `internacao` | regra + catálogo |  |
| 23 | `vb_venda_medicamentos_loja`; serviço `medicamentos_e_loja` | regra + catálogo |  |
| 24 | `vb_resultado_exames` | regra |  |
| 25 | `servicos_e_valores` | regra |  |
| 26 | `sintomas_graves_emergencia` | regra | Substitui a regra genérica de mesmo código. |
| 27 | `vb_fluxo_clinica_geral`; aliases do tipo `consultaveterinaria` | regra + agenda |  |
| 28 | `vb_exames_plano_petlove` | regra |  |
| 29 | `vb_cirurgias` | regra |  |
| 30 | `vb_vacina_sem_consulta` | regra |  |
| 31 | `vb_estetica_nao_oferece`; serviço `banho_tosa_creche` | regra + catálogo |  |
| 32 | `vb_pet_em_atendimento_presencial` | regra | Usa `{{telefone_contato}}`. **Conflita com a 46** (decisão registrada). |
| 33 | `vb_resultado_exames` | regra |  |
| 34 | `vb_insatisfacao_com_ia` | regra |  |
| 35 | `servicos_e_valores` | regra |  |
| 36 | `servicos_e_valores`; `vb_planos_petlove` | regra |  |
| 37 | `datas_e_horarios_futuros` | regra |  |
| 38 | `reagendamento_cancelamento` | regra |  |
| 39 | `reagendamento_cancelamento` | regra |  |
| 40 | `vb_agendamento_ja_garantido`; campo `agendamento_do_cliente` da busca | regra + motor |  |
| 41 | `vb_retorno_sem_custo`; serviço `retorno` | regra + catálogo |  |
| 42 | `vb_planos_petlove` | regra |  |
| 43 | `vb_agendamento_ja_garantido` | regra |  |
| 44 | `vb_exames_imagem_somente_recepcao` | regra |  |
| 45 | `vb_agendamento_ja_garantido` | regra | Duplicata da 40. |
| 46 | `vb_nao_passar_telefone_fixo` | regra | **Conflita com a 32** (decisão registrada). |
| 47 | `vb_internacao_uti` | regra |  |
| 48 | `vb_microchipagem`; serviço `microchipagem` | regra + catálogo |  |
| 49 | `vb_microchipagem` | regra |  |
| 50 | `vb_felinos_primeiros_horarios` | regra |  |
| 51 | `vb_cirurgias` | regra |  |
| 52 | `{{horarios:consultaveterinaria}}` (gerado da jornada) em `vb_consulta_clinica_info` | motor | Texto fixo "17:00 / 15:00" removido: o último horário sai da jornada e da duração. |
| 53 | `vb_curriculos` | regra |  |
| 54 | `vb_consulta_online` | regra |  |
| 55 | `vb_exames_complexos` | regra |  |
| 56 | `vb_emojis_proibidos` | regra |  |
| 57 | `vb_domiciliar`; serviço `atendimento_domiciliar` | regra + catálogo |  |
| 58 | `vb_internacao_uti` | regra |  |
| 59 | `formatacao_whatsapp`; formatador no worker | regra + código |  |
| 60 | `vb_vacinacao_gatos` | regra |  |
| 61 | `vb_horarios_ocupados` | regra |  |
| 62 | `vb_eutanasia` | regra |  |
| 63 | `escopo_e_seguranca` | regra |  |
| 64 | `vb_servico_nao_listado` | regra |  |
| 65 | (item vazio no original) | n/a | Linha numerada sem texto no prompt de origem. |
| 66 | `saudacao_inicial`; variável `{{saudacao}}` com faixas configuráveis | regra + config | O original dizia "boa noite das 18h às 07h" e "nunca boa madrugada": a faixa é configurável (padrão: bom dia a partir de 07:00). **Decisão registrada.** |
| 67 | `datas_e_horarios_futuros`; motor (nunca oferece horário passado) | regra + motor |  |
| 68 | `datas_e_horarios_futuros` | regra |  |
| 69 | `vb_dra_carol` | regra + agenda | Horários e valor vêm de `{{horarios:oncologia}}` e `{{preco:consulta_oncologia}}`. |
| 70 | `vb_dr_mauricio` | regra + agenda | Horários e valor vêm de `{{horarios:gastroenterologia}}` e `{{preco:consulta_gastroenterologia}}`. |
| 71 | `vb_cirurgias` | regra |  |
| 72 | `vb_especialistas_so_recepcao` | regra |  |
| 73 | `vb_cirurgias` | regra |  |
| 74 | `vb_duvida_sobre_agendamento` | regra |  |
| 75 | `vb_exames_complexos` | regra |  |
| 76 | `vb_almoco`; almoço 13:00–14:00 na agenda da clínica geral | regra + agenda | No n8n o código oferecia 13:00/13:30 e o prompt recusava depois; agora a agenda já não oferece. **Decisão registrada.** |
| 77 | (numeração ausente no original) | n/a | O prompt de origem pula do 76 para o 78. |
| 78 | `vb_exames_laboratoriais_permitidos` | regra |  |
| 79 | `vb_exoticos` | regra |  |
| 80 | `vb_servico_nao_listado` | regra |  |
| 81 | `vb_confirmacao_de_agendamento` | regra |  |
| 82 | `vb_consulta_clinica_info` | regra + agenda + catálogo | Horários e valor gerados (`{{horarios:...}}`, `{{preco:...}}`). |
| 83 | `servicos_e_valores`; `escopo_e_seguranca` | regra |  |
| 84 | `vb_medico_especifico` | regra |  |
| 85 | `sintomas_graves_emergencia`; `escopo_e_seguranca` | regra |  |
| 86 | `vb_servico_nao_listado` | regra |  |
| 87 | `vb_exames_requisicao` | regra |  |
| 88 | `vb_medico_especifico` | regra |  |
| 89 | `vb_atendimento_por_agendamento` | regra |  |
| 90 | `vb_planos_petlove` | regra |  |
| 91 | `vb_raca_incorreta` | regra |  |
| 92 | `vb_planos_petlove`; serviço `eletrocardiograma` | regra + catálogo |  |
| 93 | `vb_pix`; config Chave Pix | regra + config |  |
| 94 | `vb_endereco`; config Endereço | regra + config |  |

## Seções do prompt e nós do workflow

| Item | Destino | Tipo | Observação |
|---|---|---|---|
| Data atual / datas de referência | Variáveis `{{data_hoje_extenso}}`, `{{hora_atual}}`, `{{data_amanha}}`, `{{data_daqui_uma_semana}}` no contexto do compilador | variáveis | Resolvidas por mensagem no fuso da empresa (antes eram expressões do n8n que chegavam como texto). |
| Dados do cliente (e-mail, nome, pet, raça, porte, telefone) | Contexto "Cliente/Pet" do compilador (`{{cliente_*}}`, `{{pet_*}}`) | variáveis | Lidos de `dados_cliente` e do nome do WhatsApp; "não informado" quando faltam. |
| Saudação inicial e aviso 23h–07h | `saudacao_inicial`; config Saudação e aviso fora do expediente | regra + config |  |
| Função e objetivo / Fluxo inicial | `identidade_e_objetivo` | regra |  |
| Proibição de mensagens de espera | `proibicao_mensagens_espera` | regra |  |
| Regras globais da func_agenda e parâmetros por ação | `consulta_disponibilidade_agenda`; `agendamento_imediato`; `reagendamento_cancelamento`; contrato da ferramenta | regra + ferramenta | `disponibilidade_geral` deixou de existir: é deduzido de haver ou não data. |
| Consulta de disponibilidade / resposta após a ferramenta / modelo de mensagem | `consulta_disponibilidade_agenda`; campos `mensagem` e `instrucao_apresentacao` da busca | regra + motor | "2 datas × 4 horários" virou configuração do tipo (apresentação). |
| Busca automática somente para serviços agendáveis pela IA | `consulta_disponibilidade_agenda` (item 7); ferramenta limitada aos tipos que o assistente pode usar; catálogo "quem agenda" | regra + catálogo | O prompt de origem lista Oncologia como agendável, mas as regras 69/70/72 e o roteador do n8n mandam para a recepção. **Decisão registrada.** |
| Quando não houver horários | `consulta_disponibilidade_agenda` (item 6); `vb_horarios_ocupados` | regra |  |
| Continuação depois da escolha / Agendamento imediato | `agendamento_imediato` | regra |  |
| Fluxo principal de agendamento obrigatório | `coleta_dados_agendamento`; `agendamento_imediato` | regra |  |
| Fluxos secundários (consulta, exames, vacinas) | `vb_fluxo_clinica_geral`; `vb_fluxo_exames`; `vb_fluxo_vacinas` | regra | Pets por agendamento: consulta 4, vacinas e exames 1 (o original dizia "até 4" e "somente um pet" no mesmo trecho). **Decisão registrada.** |
| Modelo de confirmação do agendamento | `vb_modelo_confirmacao` | regra |  |
| Acionamento explícito de tools | `ferramentas_disponiveis`; `agendamento_imediato` | regra |  |
| Fluxo de reagendamento / cancelamento | `reagendamento_cancelamento`; registro de agendamentos do assistente | regra + motor | Localiza o agendamento por `data_antiga` no registro; evento criado pela equipe é encaminhado. |
| Regras de agendamento a domingos e sábados à tarde | `datas_e_horarios_futuros`; jornada da agenda; `{{horario_funcionamento}}` | regra + agenda |  |
| Tools (func_agenda, grava_info, Think, calculadora) | `ferramentas_disponiveis` | regra + ferramenta | `Think` e `calculadora` foram descartadas (o modelo raciocina e calcula sem elas). |
| Regra – Agendamento de exames (imagem × laboratório) | `vb_exames_imagem_somente_recepcao`; `vb_exames_laboratoriais_permitidos` | regra |  |
| Informações gerais: dados gerais, horário, site, Instagram, estilo | Config da empresa (`{{nome_empresa}}`, `{{endereco}}`, `{{horario_funcionamento}}`, `{{site}}`, `{{instagram}}`, `{{estilo_comunicacao}}`); `informacoes_da_empresa` | config + regra |  |
| Informações gerais: sobre a clínica / especialidades | `vb_sobre_a_clinica`; `vb_especialistas_so_recepcao` | regra |  |
| Informações gerais: serviços oferecidos e valores | Catálogo de serviços (Config. do atendimento › Serviços e valores); `servicos_e_valores` | catálogo |  |
| Informações gerais: microchipagem, vacinação, domiciliar, cirurgias, internamento, exames, táxi dog, medicamentos, loja | `vb_microchipagem`; `vb_protocolo_vacinacao`; `vb_domiciliar`; `vb_cirurgias`; `vb_internacao_uti`; catálogo | regra + catálogo |  |
| Informações gerais: convênios e planos | Config Planos aceitos (`{{planos_aceitos}}`); `vb_planos_petlove` | config + regra |  |
| Encerramento de atendimento | `encerramento_atendimento`; config Frase de encerramento; estado `finalizado` | regra + config |  |
| Restrições e regras rígidas (foco, tecnologia, LGPD, rigor) | `escopo_e_seguranca` | regra | A persona "Balthazar" do prompt de origem é de outro cliente e foi descartada. |
| Text Classifier de atendimento humano | Estado `atendimento_humano` (Config. do atendimento › Estados) | estado |  |
| AI Agent de transferência para humano | `mensagem_cliente` do estado `atendimento_humano` | estado |  |
| LLMResumoAtendimento (humano e finalizado) | `resumo_instrucao` dos estados + notificações | estado |  |
| Parser Chain (divisão e formatação WhatsApp) | `formatarParaWhatsApp` / `dividirMensagens` + pausa entre mensagens (config) | código |  |
| consulta_produtos (Google Sheets) | (descartado) | descartada | O nó não está ligado ao agente no export; a tabela de preços vive no catálogo de serviços. |
| Gmail (confirmação) e Google Sheets (auditoria) da agenda | Convite do Google Agenda ao cliente + registro `agenda_agendamentos` + aviso por WhatsApp à equipe | motor | **Decisão registrada**: o e-mail HTML e a planilha não foram reimplementados. |
| Tag do cliente ao agendar (client_tags) | `tag_id` do tipo de agendamento | motor |  |

## Decisões que dependem da clínica (valores iniciais já aplicados na semente)

| Tema | Conflito no prompt original | Valor aplicado | Onde mudar |
|---|---|---|---|
| Oncologia e gastro | Lista "pode agendar" inclui Oncologia, mas 69/70/72 e o roteador do n8n mandam para a recepção | Só a recepção agenda (tipos sem operações para o assistente) | Regras da agenda › tipo › "O assistente pode" |
| Pergunta de horário | Regra 6 manda perguntar a hora; o fluxo manda mostrar os horários do dia | Mostra os horários do dia | Meu Prompt › `consulta_disponibilidade_agenda` |
| Telefone fixo | 32 informa o fixo; 46 proíbe passar o fixo | As duas regras ficaram; revisar qual vale | Meu Prompt › `vb_pet_em_atendimento_presencial` / `vb_nao_passar_telefone_fixo` |
| Pets por agendamento | "Até 4 nomes" e "somente um pet" no mesmo trecho | Consulta 4; vacinas e exames 1 | Regras da agenda › tipo › "Pets por agendamento" |
| Almoço | Código oferecia 13:00/13:30; regra 76 recusa | Agenda bloqueia 13:00–14:00 | Regras da agenda › Almoço, pausas e bloqueios |
| Saudação da madrugada | "Boa noite até 07h" × "nunca boa madrugada" | Bom dia a partir de 07:00 | Config. do atendimento › Empresa › Saudação |
| E-mail e planilha de agendamento | Gmail HTML + Google Sheets no n8n | Convite do Google Agenda + registro + aviso WhatsApp | Regras da agenda › tipo › "Enviar convite" / Notificações |
