# Sementes do C.V.I. - Centro Veterinário Integrado Fazenda Rio Grande

Sementes com dados do **C.V.I. - Centro Veterinário Integrado** (empresa, assistente Balthazar, horários, catálogo de serviços, valores e regras de atendimento).

| Arquivo | Descrição |
| --- | --- |
| `clinica-cvi.sql` | Dados e regras oficiais do **C.V.I. - Centro Veterinário Integrado** (Balthazar). |

## O que a semente faz

- Preenche `atendimento_config` com os dados oficiais do C.V.I. (Balthazar, telefones de Fazenda Rio Grande, endereço na Rua Manoel Claudino Barbosa, horários de atendimento).
- Configura canais de notificação e alerta operacional da recepção e parceiros.
- Configura tipos de atendimento (consultas de clínico geral por ordem de chegada, vacinas Zoetis sem consulta prévia, especialidades e exames).
- Cadastra os serviços e valores no catálogo (`clinica_servicos`).
- Grava as regras oficiais de atendimento e compila a versão vigente do prompt do Balthazar.
