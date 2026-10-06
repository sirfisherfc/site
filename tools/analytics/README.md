# Presença no Google e medição

## Relatório reproduzível

Execute com o Python do ambiente local de analytics:

```powershell
site/tools/analytics/.venv/Scripts/python.exe -X utf8 site/tools/analytics/report.py --days 30 --end-date 2026-09-30 --operations
```

Sem data explícita, usa 30 dias com três dias de margem para consolidação.
Compara com os 30 dias anteriores. O total de usuários vem de uma consulta
sem dimensão, nunca da soma dos canais. O site principal é separado do portal.

O relatório distingue consultas de marca, comerciais sem marca, pôr do sol
e outras consultas. Termos ocultados pelo Search Console não entram nesses
grupos. O agrupamento é uma classificação de texto, não uma identificação
de clientes novos. A origem `qr_code` pode representar clientes já presentes.

Cliques são intenções. `reservation_confirmed` registra a conclusão da reserva;
`visit_realized` registra comparecimento marcado pela equipe. Eventos GA4 podem
faltar por bloqueio da tag ou ausência dos identificadores. `--operations`
consulta somente agregados por endpoint de banco com usuário de leitura,
sem nomes, contatos, identificadores de clientes ou dados financeiros.

As reservas criadas usam data de criação no fuso de Fortaleza; comparecimentos
usam data da visita. Esses números não formam uma coorte de conversão direta.
Primeiro comparecimento **registrado** não comprova primeira visita à casa.
Não usar valores estimados dos eventos como faturamento apurado.

Em 06/10/2026, `click_menu` deixou de ser evento principal no GA4. Continua
sendo coletado como evento de intenção. Reservas, comparecimentos e eventos
de contato existentes foram preservados. A mudança afeta comparações futuras
de engajamento; não altera retroativamente os relatórios antigos.

## Cardápio do Perfil da Empresa

O arquivo público `cardapio/dados/cardapio.json` é a fonte dos itens e preços.
O usuário confirmou os preços publicados em 06/10/2026. Pesos e alérgenos
continuam em conferência e não são enviados como alegações ao Google.

```powershell
python site/tools/analytics/build_google_menu.py --output tmp/google_food_menu_payload.json
```

O gerador inclui itens disponíveis e variantes, com centavos convertidos para
Money do Google. Exclui taxas de serviço/rolha/embalagem, que não são pratos.
O payload validado contém 78 itens, 10 seções e 6 opções adicionais. Usa `pt`,
locale aceito na publicação validada; a tentativa inicial com `pt-BR` foi
recusada pelo endpoint. O gerador não publica nem acessa OAuth.

Antes de publicar futuras mudanças, ler o menu atual, reconciliar outras
edições e conferir preços. Atualizar FoodMenus com OAuth autorizado e ler
novamente para comparar preços, itens e variantes. Não usar PriceList legado
para sobrescrever o menu. Nunca guardar tokens no payload ou no Git.

## Rotina da equipe

- Oferecer o QR de avaliações a todos os clientes, sem seleção por satisfação,
  pedido de nota específica ou benefício. Texto: “Como foi sua visita? Se
  quiser, conte sua experiência no Google.”
- Material para impressão: `tools/perfil-google/avaliacoes.html`. O QR aponta
  diretamente para a avaliação da unidade da Beira-Mar, sem formulário prévio.
- Conferir novas avaliações e responder com atenção à experiência descrita.
  Não divulgar nomes, contatos, detalhes de reservas ou outros dados privados.
- Publicar fotos reais e recentes quando houver material novo: fachada,
  localização, mesas e pratos disponíveis. Conferir consentimento de pessoas
  identificáveis. Evitar duplicar as fotos recentes de 28 e 30/09.
- Conferir horários especiais antes de cada feriado/evento, e atualizar Google
  e site juntos. Em 31/12/2026, a abertura foi confirmada das 9h às 2h de 01/01.
- Entrega exclusivamente pelo 99Food; sem sala privativa; mesas acessíveis,
  banheiro sem acessibilidade, conforme confirmação do proprietário.
- Comparar descoberta comercial, cliques, rotas, contatos, reservas e visitas
  em períodos fechados. Não atribuir causalidade ou melhora de ranking a uma
  publicação isolada. Esta rotina não cria envios nem automações agendadas.

## Referências

- [Cardápios Google](https://developers.google.com/my-business/content/update-food-menus)
- [Avaliações e QR](https://support.google.com/business/answer/16816815?hl=pt-BR)
- [API da tag Google](https://developers.google.com/tag-platform/gtagjs/reference#get)
- [Consulta Supabase somente de leitura](https://supabase.com/docs/reference/api/v1-read-only-query)
