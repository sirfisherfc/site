# Presença no Google e medição

## Site Audit da Semrush em 25/10/2026

O rastreador da auditoria não executa JavaScript, assim como robôs de busca de
IA. Por isso o cardápio aparecia sem h1, com 68 palavras e razão texto/HTML de
0,01: a lista só existia depois do `cardapio.js`. Agora
`tools/cardapio/prerenderizar.py` grava no `<main>` a mesma marcação que o
script desenha em português (h1, 10 seções, 78 itens, ~1.400 palavras sem JS).
O script troca por uma cópia igual ao carregar, sem salto (CLS 0). O passo roda
no pre-commit, antes do `versionar_assets.py`, e o workflow `verificar-assets`
confere. Quando o `exportar_snapshot.py` do gestao atualizar `CARDAPIO-DADOS`,
o commit no site regenera o catálogo. O `versionar_assets.py` não mexe nesse
bloco: as fotos mantêm os endereços do script e não são baixadas duas vezes.

Outras correções:

- Réveillon: o `organizer` do Event (`Restaurant`, um LocalBusiness) ganhou o
  `address` obrigatório.
- `robots.txt`: o Cloudflare antepunha o bloco gerenciado dele
  (`Content-Signal`, `User-agent: *` e robôs de treino de IA bloqueados), o que
  duplicava o grupo `User-agent: *` do site. O bloco foi desligado
  (`gestao/scripts/cloudflare/cf.py robots`; `--religar` desfaz) e o
  `robots.txt` do site assumiu a política de rastreamento. Depois de liberar
  `Google-Extended`, o proprietário autorizou remover também o grupo dos
  31 agentes, incluindo GPTBot, ClaudeBot e CCBot. O grupo geral permite
  rastrear o conteúdo público, inclusive para coleta e treinamento de IA.
  Busca e assistentes de IA seguem permitidos. Essa abertura não garante
  indexação, uso no treinamento ou citações nas respostas.
- `llms.txt` com a descrição da casa e os links das páginas, sem preços nem
  horários, que mudam.
- Como chegar e Almoço executivo passaram a linkar `/reservas/`.

Ficaram como estão: minificação de CSS (o Cloudflare já comprime em Brotli;
um passo de build traria arquivos derivados para ganho de poucos KB) e a
razão texto/HTML da home, do executivo e da EN, que vem do CSS embutido e
das imagens responsivas, escolhidos para o PageSpeed.

## Pesquisa ampliada da Semrush em 25/10/2026

A primeira entrega da janela de três dias reúne 298 termos distintos e oito
oportunidades por URL. Os originais e derivados privados estão em
`_materiais/revisao-seo-2026-10-25/semrush/`, com manifesto e registro de consumo.
O plano e os limites ficam em `gestao/docs/SEMRUSH_3_DIAS_2026-10-25.md`.
Depois da conexão do navegador, foram configurados 40 termos para Google,
Fortaleza e celular, além de 12 perguntas em português e quatro em inglês para
ChatGPT/Fortaleza, em campanhas separadas. As duas coletas foram concluídas em
25/10; uma data ainda não permite medir evolução.

O On Page SEO Checker voltou a ler a página EN de fish and chips após uma
exceção restrita no Cloudflare para o SemrushBot-SI. A regra limita a leitura
à faixa de IPs oficial, ao host público, a GET/HEAD sem parâmetros e aos
caminhos do sitemap, mais robots.txt e sitemap.xml. O relatório em `gestao`
registra a regra, as provas e como desativar essa exceção.

A abertura do executivo e o link do guia agora identificam a refeição
individual e os dias/horários confirmados. O guia distingue os caminhos de
grupos, e a página de eventos identifica Beira-Mar/Fortaleza. A jornada EN
mantém o retorno à home em inglês e foi alinhada às regras de mesa e rota;
as aproximações em dólares sem data foram retiradas. Os preços em reais,
URLs e ofertas continuam com as fontes e regras já confirmadas.

### Links de visita e orientação de rota

A legenda do almoço na home agora abre o executivo individual. O bloco do
restaurante no guia da Beira-Mar também abre o cardápio completo. Os dois
links registram `click_menu` com a posição do clique, usando a medição existente.
O sitemap passou a registrar 25/10 para as alterações já publicadas no
cardápio e no Réveillon.

A página Como chegar passou a orientar a caminhada conforme o hotel de
partida, com rota para Av. Beira Mar, 3421, em frente ao Jardim Japonês.
O texto visível e a resposta FAQ estruturada usam a mesma orientação;
foram retirados o sentido fixo com o mar à direita e a faixa geral de 5–20
minutos, que dependem do ponto de partida.

A conferência local cobriu home, guia e Como chegar em 390 e 1440 px, nos
temas claro e escuro: foco por teclado, contraste e ausência de rolagem
horizontal. Os novos links abriram os destinos e registraram uma ocorrência
local por clique. A rede externa ficou bloqueada. Os 108 testes existentes
de CTAs, atribuição e carregamento de marketing passaram, assim como os
verificadores de catálogo estático, assets, CSP e CSS embutido.

O verificador CSP também passou a normalizar CRLF ao ler o HTML do clone
Windows. A leitura anterior falhava ao procurar o comentário com LF.
A política e os hashes dos scripts foram preservados.

### Pets, grupos e ocasiões de evento

As homes PT e EN agora mostram a política existente: pets de pequeno e médio
porte são bem-vindos nas mesas externas. O fato já constava no FAQ estruturado
da home PT; a leitura autenticada do Perfil Google em 25/10 também confirmou
`attributes/welcomes_dogs=true`. O texto visível e o FAQ em ambos os idiomas
mantêm os mesmos limites.

As orientações de grupos também foram alinhadas no texto visível e no FAQ:
portal para até dez pessoas, WhatsApp para 11–29 e proposta de evento para
30–100 pessoas sentadas. A home EN avisa que o configurador de eventos está
em português. A página de eventos explicita aniversários e confraternizações
na abertura e na descrição, preservando title, H1 e as regras do configurador.

### Conferência posterior das páginas de reserva e eventos

A página pública `/reservas/` passou a usar a mesma divisão da home: portal
para até dez pessoas, WhatsApp para 11–29 e configurador para eventos de
30–100 pessoas sentadas. O link para `/eventos/` aparece junto da regra,
e o FAQ estruturado usa os mesmos limites. A resposta estruturada sobre a
posição da mesa também passou a informar a distribuição pela equipe na
chegada, conforme a disponibilidade, como já dizia o texto visível.

A abertura e a descrição de `/eventos/` passaram a identificar Meireles,
confraternizações de empresa e os formatos de petiscos, almoço ou jantar
já oferecidos no configurador. As três ausências na primeira coleta local de
ChatGPT ajudaram a conferir essas jornadas; elas ainda não explicam causas
ou resultados de busca. O relatório e o ZIP da entrega anterior permanecem
como snapshots da coleta, sem substituir seus arquivos por dados posteriores.

## Revisão de 25/10/2026

O relatório consolidado, as prioridades e o acompanhamento de 30/60/90 dias
ficam em `gestao/docs/REVISAO_SEO_LOCAL_CONVERSAO_2026-10-25.md`, no workspace.
As respostas e capturas locais ficam em `_materiais/revisao-seo-2026-10-25/`,
ignorado pelo Git. Foram relidos GA4, Search Console, Perfil Google e os
agregados operacionais pela rota de leitura do portal. O funil novo tem só
um dia consolidado em 22/10; esse volume ainda não permite avaliar desistências.

A revisão corrigiu o contraste do aviso de almoço fora do horário em ambos
os temas, alinhou as orientações de reserva às regras confirmadas e atualizou
a prova de confiança da home PT/EN e da Conheça para 4,7/5 e 813 avaliações,
consultadas em 25/10. Os depoimentos selecionados e o dado de Instagram mantêm suas fontes
e datas anteriores. `noindex` da Conheça e do redirecionamento legado
`/en/menu/` continua intencional; o cardápio em inglês usa `/cardapio/?lang=en`.
Os dois botões legados de almoço/fish and chips agora abrem o cardápio próprio.
As sete opções executivas continuam na página de almoço; o botão identifica
o cardápio completo da casa. O aviso de privacidade acompanha os serviços
atuais, incluindo Resend para e-mails e a retirada da referência ao Hubt.

Neste PC, o `.venv` sincronizado aponta para o Python do outro computador.
Os relatórios foram executados com o Python local e os SDKs já disponíveis.
O instalador do MCP agora resolve o caminho real do ambiente após a criação,
incluindo o redirecionamento `LocalCache` do Python da Microsoft Store.
A versão continua fixada em 0.8.0 e o cadastro continua somente para leitura.
O cliente aberto precisa ser reiniciado para carregar o servidor cadastrado.
Referência: [configuração MCP do Codex](https://learn.chatgpt.com/docs/extend/mcp).

O script legado `upload_and_create_ads.py` exige `META_ADS_TOKEN` no ambiente
privado; não aceita credencial no código nem como argumento de linha de comando.
Ele cria anúncios e não deve ser executado durante auditorias de leitura.

## Acesso ao Supabase portal

Antes de solicitar reconexao, executar no workspace:

```powershell
python site/tools/analytics/supabase_credentials.py
```

A rotina verifica o projeto esperado sem imprimir credenciais. Reutiliza
`SUPABASE_ACCESS_TOKEN` do ambiente ou de `reservas/.env.local`, mantido no
OneDrive entre os dois PCs e ignorado pelo Git. Scripts podem importar
`access_token()` desse modulo. Nao imprimir seu retorno. Consultas de auditoria
continuam usando a rota de leitura da Management API.

## MCP oficial do Google Analytics

Para preparar o Codex neste computador, execute uma vez na raiz do workspace
com Python 3.11 ou mais recente:

```powershell
python site/tools/analytics/configurar_mcp.py
```

O instalador fixa `analytics-mcp==0.8.0` em um ambiente isolado no
`LOCALAPPDATA`, fora do OneDrive, e registra `google_analytics` na configuração
local compartilhada pelo aplicativo desktop, CLI e extensão do Codex. Reutiliza
o `service_account.json` privado desta pasta por ADC, sem copiar a chave ou
alterar o ambiente dos relatórios. Ferramentas de escrita não são habilitadas.
O cadastro reserva até 90 s para a inicialização do SDK Google.

Reinicie o cliente uma vez após cadastrar o servidor. A configuração fica
salva e o cliente inicia o MCP automaticamente nas próximas sessões; a conta
de serviço renova suas credenciais temporárias sem login interativo. No outro
PC, execute o mesmo instalador uma vez. A chave precisa continuar disponível
e autorizada no Google. Esta configuração local não conecta o ChatGPT web.

`codex mcp get google_analytics` confere o cadastro, mas não comprova acesso
ao Google. A validação real deve ler a propriedade `353205396` com
`get_property_details` e executar um `run_report` agregado mínimo. Não imprimir
credenciais ou dados pessoais nos testes. Em 22/10/2026, ambas as consultas
passaram no PC configurado, sem novo login, com nove ferramentas de leitura.
O MCP complementa este relatório;
Search Console, Perfil da Empresa e agregados do portal continuam nas rotinas
próprias. Fontes: [servidor oficial](https://github.com/googleanalytics/google-analytics-mcp)
e [configuração MCP do Codex](https://learn.chatgpt.com/docs/extend/mcp).

## Relatório reproduzível

Para acessar o Perfil da Empresa, verificar primeiro a autorização persistente
do projeto de gestão, usando o Python local:

```powershell
python site/tools/analytics/google_oauth_helper.py --verificar
```

O comando reutiliza `gestao/scripts/gbp/gbp.py` e as credenciais `GOOGLE_OAUTH_*`
do ambiente ou de `gestao/.env` ignorado pelo Git. Em 07/10, a renovação por
refresh token e leituras da ficha/avaliações funcionaram sem login manual.
Não pedir um novo Access token de uma hora enquanto esse acesso funcionar.
O modo sem `--verificar` gera uma URL de consentimento somente quando uma nova
conexão for necessária. Não salvar os segredos no site ou no repositório.

Referência: [acesso offline ao Perfil Google](https://developers.google.com/my-business/content/implement-oauth#offline-access).

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

### Posição dos botões e continuidade até o formulário (22/10/2026)

Em 25/10, os consumidores de `sf_attribution_v1` passaram a rejeitar copias
com 90 dias ou mais, sem data valida ou com data futura. O cookie recebe
somente o tempo restante desde `captured_at`; navegacao interna conserva
esse instante e a origem externa. A integracao de leitura do Instagram e
os agregados de reservas estao documentados em
`gestao/docs/INTEGRACAO_INSTAGRAM_ANALYTICS.md`, na raiz do workspace.

Os eventos de clique existentes recebem `cta_position`, definido explicitamente
por `data-position` no HTML. Home PT/EN, Conheça e páginas de descoberta usam
posições como `topo`, `abertura`, `pratos`, `reservas`, `visita` e `rodape`.
No cardápio, os links finais usam `cardapio_rodape`. Nomes de eventos, campanhas,
carregador adiado e QR impresso permanecem os mesmos.

Os links para a reserva comum levam a mesma posição em `sf_cta`, já no HTML,
inclusive antes do carregamento das tags ou com JavaScript indisponível. O
formulário pode assim usar `cta_position` nos estágios seguintes. Os únicos
valores repassados são `topo`, `abertura`, `reservas`, `visita`,
`cardapio_rodape` e `conteudo`; não contêm texto digitado ou dados de clientes.
`sf_cta` é contexto do botão, separado de `sf_origin` e da atribuição de
campanha. Não vira UTM, não é salvo como campanha e não substitui Google,
Instagram ou outro canal. A decoração adicional exige HTTPS e o host exato
`reservas.sirfisher.com.br`; não adiciona `sf_cta` a WhatsApp, Maps ou ao
fluxo de Réveillon. Idioma, origem, identificadores e âncora são preservados.

Para consultar `cta_position` no GA4, usar a dimensão personalizada de escopo
de evento correspondente. O código de coleta não registra dimensões por si
só e o registro não disponibiliza o parâmetro retroativamente. A continuidade
até o resultado operacional depende dos identificadores efetivamente recebidos
pelo portal; ausência de confirmação no Analytics não comprova desistência.

Validação offline dos handlers reais e URLs, sem enviar eventos ou criar reservas:

```powershell
deno test --allow-read tools/analytics/reservation_cta_test.mjs tools/analytics/attribution_test.mjs tools/analytics/marketing_loader_test.mjs
```

O teste inclui as versões PT/EN, cliques antes das tags, tags ausentes, storage
bloqueado, links inseridos depois, proteção de destino e o rodapé real do cardápio.

### Revisão reproduzível do funil e da coorte operacional

```powershell
site/tools/analytics/.venv/Scripts/python.exe -X utf8 site/tools/analytics/reservation_funnel_report.py --start 2026-09-22 --end 2026-10-19
site/tools/analytics/.venv/Scripts/python.exe -X utf8 site/tools/analytics/reservation_funnel_report.py --days 7 --end-date 2026-10-29
```

Executar na raiz do workspace. Sem datas, usa sete dias com três dias de margem
para consolidação em Fortaleza. Aceita até 366 dias. `--no-operations` consulta
somente GA4. O script reutiliza a conta de serviço existente, os SDKs Alpha/Beta
instalados no ambiente de analytics e o helper canônico de acesso ao portal.
Não instala dependências, envia eventos, cria reservas ou exporta dados pessoais.

O funil fechado consulta, em sequência, `reservation_form_view` →
`reservation_form_start` → `reservation_submit_attempt` → `reservation_confirmed`.
Cada etapa exige o parâmetro nativo `form_kind=standard`, sem depender da
propagação da dimensão personalizada, e permite eventos intermediários. Mede
usuários que percorreram a sequência no período, não necessariamente na mesma
sessão ou na mesma reserva. Mostra recortes por dispositivo, origem/mídia da
sessão e posição do CTA quando disponível. Não soma usuários desses recortes.
Cada recorte traz até 15 valores, limite da API, além do total reservado.
Os metadados de amostragem e limitações são preservados. As novas etapas só
existem a partir da publicação de 22/10; a janela anterior serve como linha de
base operacional, sem inventar um funil retroativo.

Contagens isoladas por evento são mostradas à parte, sem filtro novo de
`form_kind`: `reservation_confirmed` já era exclusivo da reserva comum,
enquanto Réveillon usa outros eventos. Sua contagem inclui confirmações legadas
anteriores à instrumentação e não é a conclusão do novo funil sequencial.
Recortes de dimensões novas indisponíveis aparecem como pendentes, sem impedir
o total do funil. O cadastro dessas dimensões não retroage os dados.

A consulta ao banco usa exclusivamente a rota Management API
`database/query/read-only`, com parâmetros de data e o projeto `portal` fixo.
A coorte é de reservas `source=public_site` criadas no mesmo intervalo civil
em Fortaleza, com limite inicial inclusivo e final exclusivo. Retorna apenas
total criado, total com os dois identificadores GA preenchidos e contagem por
status atual dessa coorte. Não exporta os identificadores nem usa a data da
visita como denominador. Contagens GA4 e banco são paralelas e têm cobertura
parcial: não comprovam correspondência individual, igualdade, causalidade ou
receita. O fuso retornado pelo GA4 aparece no relatório para conferir o recorte.

Teste offline dos requests reais dos SDKs e da agregação, com rede bloqueada:

```powershell
site/tools/analytics/.venv/Scripts/python.exe -X utf8 -m unittest discover -s site/tools/analytics -p test_reservation_funnel_report.py
```

A fixture SQL roda em memória com adaptações de dialeto para data/fuso e JSON;
a conferência no Postgres é feita pela leitura real do relatório. Referências:
[funis da Data API](https://developers.google.com/analytics/devguides/reporting/data/v1/funnels)
e [consulta somente de leitura do Supabase](https://supabase.com/docs/reference/api/v1-read-only-query).

As reservas criadas usam data de criação no fuso de Fortaleza; comparecimentos
usam data da visita. Esses números não formam uma coorte de conversão direta.
Primeiro comparecimento **registrado** não comprova primeira visita à casa.
Não usar valores estimados dos eventos como faturamento apurado.

Em 06/10/2026, `click_menu` deixou de ser evento principal no GA4. Continua
sendo coletado como evento de intenção. Reservas, comparecimentos e eventos
de contato existentes foram preservados. A mudança afeta comparações futuras
de engajamento; não altera retroativamente os relatórios antigos.

Na home em português e inglês e na página Conheça, os SDKs de marketing
(GA4, Meta e OpenAI) esperam a primeira interação (toque, rolagem, tecla ou
mouse) ou 7 s depois do `load`, com teto de 15 s (desde 13/10/2026; antes,
Meta/OpenAI esperavam só o `load` e o GA4 carregava de imediato). As filas
`dataLayer`, `fbq` e `oaiq` são criadas na hora, então nenhum evento se perde.
`marketing_loader_test.mjs` (Deno) verifica fila, ausência de SDK duplicado e
teto. Visitas que saem antes disso sem interagir não chegam a ser medidas:
a partir de 13/10/2026 as sessões e PageViews de rejeição imediata caem.

## Página de pôr do sol: linha de base de 20/10/2026

A melhoria de conversão preserva URL, canonical, title, description, H1 e as
12 linhas da tabela mensal. CSS e cálculo diário ficam em `por-do-sol.css` e
`por-do-sol.js`, exclusivos da página. O cálculo NOAA/Meeus usa as coordenadas
da casa, horário `America/Fortaleza`, horizonte padrão e arredondamento para
minuto; não consulta serviço externo nem localização do visitante. Depois do
horário de hoje, mostra também o de amanhã. Sem JavaScript, faixa e tabela
continuam disponíveis. Nuvens, prédios e atmosfera afetam a visibilidade real.

Testes de datas de referência, fuso, virada do dia/ano e ano bissexto:

```powershell
node --test tools/analytics/sunset_test.mjs
```

O ambiente local também tem Node no driver do Playwright, em
`tools/analytics/.venv/Lib/site-packages/playwright/driver/node.exe`.

Base filtrada pela URL, 21/09–18/10/2026: Search Console 101 cliques e 42.831
impressões. Sessões iniciadas nessa página no GA4: 86, sendo 79 google/organic,
83 em celular e três em computador. Houve seis eventos click_menu, um
click_maps e nenhum click_reservation nesse conjunto de sessões; não são
visitas presenciais nem um funil deduplicado. A captura de três meses enviada
pelo proprietário foi reconciliada com 21/07–18/10: a consulta “pôr do sol hoje”
nessa URL teve 86 cliques e 34.835 impressões.

Comparar janelas de 28 dias após consolidação, mantendo separado Search Console
de GA4 e considerando a mudança de carregamento das tags em 13/10. Acompanhar
cliques em rota/cardápio/reserva e resultados operacionais identificados, sem
prometer efeito causal ou significância com esse volume. Os cliques preservam
os nomes de evento existentes; `cta_position` distingue abertura/pratos/visita
no payload. Para usá-lo como dimensão nos relatórios GA4, é necessário seu
registro como dimensão personalizada; isso não foi alterado nesta entrega.

O foco para quem decide vir hoje é a rota. Reservas online para o mesmo dia
encerram às 15h30; depois, atendimento por chegada. Não prometer posição de
mesa, primeira fila, ausência de espera, clima ou vista do disco solar.

Após a revisão aprovada em 20/10, a abertura segue a ordem título, horário
compacto, foto real das mesas/mar, convite, rota e cardápio. O resumo anual foi
mantido junto à tabela e a foto anterior de paisagem passou ao bloco da visita.
No desktop, a foto fica ao lado do título/horário/ações. O quadro diário e as
linhas de horário se adaptam também ao texto ampliado, sem sobreposição.

## Verificação móvel de 06/10/2026

PageSpeed Insights autenticado, home em produção, estratégia móvel:
acessibilidade 100 (antes 96), SEO 100 e desempenho 66. O teste anterior à
publicação marcou 68; execuções intermediárias variaram de 60 a 66. Não há
evidência de ganho consistente de desempenho pelo escore sintético. A última
execução mediu LCP 7,1 s, FCP 2,6 s, bloqueio total 160 ms e CLS zero.

Dados de campo CrUX retornados para a URL: LCP 1.419 ms, INP 152 ms e CLS zero,
todos na faixa boa. São dados de uma janela histórica, não efeito comprovado
da publicação de hoje. O próximo diagnóstico de velocidade deve comparar
várias execuções sob condições equivalentes e investigar o atraso da imagem
principal; não remover medição para melhorar artificialmente o escore.

Foram corrigidos contraste de textos/botões e nome acessível do link do menu.
A captura móvel do Lighthouse foi inspecionada. O navegador integrado não
estava disponível: não houve teste manual completo de navegação ou reserva.

## PageSpeed de 13/10/2026

Medir com `python site/tools/analytics/pagespeed.py` (padrão: home com `www`,
celular e desktop). Consulta pela API com `PAGESPEED_API_KEY` (chave dedicada, em `gestao/.env`
ignorado; a cota anônima vive esgotada e o OAuth do Perfil da Empresa não
tem escopo para o PageSpeed). Antes das correções: desktop 89/96/100/100,
celular 64/100/100/100 (desempenho, acessibilidade, boas práticas, SEO).
CrUX de campo no celular: LCP 1,6 s, INP 155 ms, CLS 0, todos bons.

Correções publicadas: SDKs de marketing adiados (acima); CSS da home embutido
e minificado por `tools/css/embutir_css.py` (rodar após editar `style.css`
ou `desktop.css`; `--verificar` acusa bloco velho); `--sea` clara passou a
#226861 (contraste 4,5:1 sobre todos os fundos claros); variantes 340 px das
seis fotos da galeria, `prato-480` e emblema 64 px/AVIF.

Depois da publicação (commit 4f6d0cb, duas execuções): desktop 100/100/100/100
(LCP 0,7 s, TBT 0) e celular 88 e 93 em desempenho, 100 nas demais (LCP 3,0 a
3,2 s, TBT 0 a 130 ms). Surgiu CLS de ~0,02 pela troca das fontes web, agora
que o texto pinta antes delas; segue na faixa boa (< 0,1).

Segunda rodada (commits 05e2aed e 57e5935): o texto corrido passou da Work
Sans para a fonte do sistema em todo o site, o rodapé da home deixou o
itálico (a home só baixa a Fraunces, 66 KB, contra 156 KB antes), o contador
de visitas espera o `load` e a página ociosa, e os SDKs passaram a esperar
7 s (o PageSpeed mede até ~5,25 s após o `load`; com 4 s, às vezes entravam
na medição). Celular: 99 com `www` (LCP 1,8 s) e 93 a 95 sem `www`, pelo
redirecionamento. Desktop: 100 nos dois.

Cache: desde 13/10/2026 o Cloudflare fica na frente do GitHub Pages (proxy
em `www` e no domínio sem `www`; ferramenta em `gestao/scripts/cloudflare/cf.py`).
Endereços de `/assets/` com `?v=` saem com `max-age` de um ano; o resto
(HTML, `cardapio/dados/`, fotos montadas pelo `cardapio.js`) segue com 10
minutos. O `?v=` é o hash do conteúdo, gravado por
`tools/cache/versionar_assets.py`: o gancho `.githooks/pre-commit` roda o
script em todo commit (ativo no clone por `git config core.hooksPath
.githooks`) e o workflow `verificar-assets` confere no GitHub. Trocar uma
foto, fonte, CSS ou JS, mesmo mantendo o nome, já muda o endereço; não há
regra para lembrar nem cache para limpar. O domínio sem
`www` é redirecionado na borda do Cloudflare. Com isso, o celular marcou 100
(duas de três execuções; 96 com o cache da borda ainda frio) e o desktop 100.

Fora do código: o GitHub Pages fixa `Cache-Control: max-age=600` e o
redirecionamento `sirfisher.com.br` → `www`. O teste do Search Console usa o
domínio sem `www` e paga esse redirecionamento (0,8 s no celular); visitantes
vindos do Google, do Perfil e dos anúncios já chegam pelo `www`.

## Velocidade, acessibilidade e segurança em todas as páginas (13/10/2026)

Resultado (celular, `monitorar.py`): todas as páginas entre 98 e 100 em
desempenho e 100 em acessibilidade, boas práticas e SEO (a Conheça tem
`noindex` de propósito). Dados reais da origem: LCP 1,4 s, INP 145 ms, CLS 0.

- Marketing: as 12 páginas com GA/Meta usam o carregador adiado (interação
  real ou 7 s após o `load`). `pointermove` sem deslocamento é ignorado: o
  PageSpeed redimensiona a tela e o navegador gera esse evento sob o cursor
  parado, o que antes carregava os SDKs no meio da medição.
- Cardápio: miniaturas com versões de 240 px (`assets/img/*-240.*`).
- Contraste: `--coral-texto` (#a33a20) nas etiquetas de oferta; aba ativa
  do cardápio e botão de Eventos em #b64226.
- Segurança: `tools/seguranca/csp.py` grava em cada página a CSP com hash
  dos scripts + `strict-dynamic` e Trusted Types (pre-commit e workflow).
  Scripts de `assets/js` entram por um bloco no fim do body; `<script src>`
  no HTML, `on*=` e `javascript:` são recusados. No Cloudflare (`cf.py site`):
  HSTS de 1 ano com subdomínios, `X-Frame-Options`, `frame-ancestors`, COOP,
  `Referrer-Policy` e `Permissions-Policy`.

Ferramentas (Playwright em `tools/analytics/.venv`):

- `tools/acessibilidade/auditar.py`: axe-core + teclado, todas as páginas,
  celular/desktop, claro/escuro.
- `tools/seguranca/testar_navegador.py`: sem violação de CSP nem erro de
  console; GA, Meta, OpenAI e contador funcionando (envios interceptados).
  `SITE_BASE=https://www.sirfisher.com.br/` testa o site publicado.
- `tools/analytics/monitorar.py`: PageSpeed das páginas principais + dados
  reais; sai com erro se algo piorar. Roda localmente (chave do gestao/.env).
  O workflow `monitorar-velocidade` está desativado desde 13/10/2026 (só
  manual; reativar devolvendo o `schedule` e cadastrando o segredo
  `PAGESPEED_API_KEY`).

## Cardápio do Perfil da Empresa

O gerador lê itens e preços de `cardapio/dados/cardapio.json`, derivado do
catálogo editorial versionado conforme `gestao/docs/HANDOFF_CARDAPIO.md`.
Não editar o JSON público nem o bloco embutido no HTML manualmente.
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

## Entrada dos anúncios e prova de confiança

Desde 06/10/2026, a home continua atendendo ao QR das mesas. A página
`/conheca/` apresenta a casa a quem chega pelo anúncio: fotos reais, preços
conferidos no cardápio, rota, horários e reserva opcional. O anúncio aponta
para ela com campanha `sir_fisher_outubro_2026`; os links de reserva recebem
a origem e o identificador pelo mesmo `atribuicao.js` das demais páginas.
Cliques no cardápio e no Maps continuam sendo intenção, não venda ou visita.

A nova página usa `noindex,follow` por ser um destino de mídia paga, mantendo
a home como entrada orgânica. A falha `is-crawlable` e a nota SEO 69 no
Lighthouse são esperadas nessa página; não remover a diretiva apenas para
elevar o escore. A validação publicada em 07/10 marcou desempenho 77 no celular
e 100 no desktop, acessibilidade 100 nos dois e CLS zero; LCP 4,4 s e 0,8 s.
Antes, execuções marcaram 65/94, 72/88 e 73/98; variação de laboratório não
comprova ganho de velocidade para visitantes reais. O LCP móvel ainda merece
atenção ao acompanhar os dados de campo.
Capturas dos dois formatos foram inspecionadas. O navegador integrado não está
disponível; a consulta pública em navegador separado exibiu Maps limitado e
verificação na Busca. Não foi criada uma nova reserva de teste ponta a ponta.
O navegador separado validou 320/390/1440 px, temas claro/escuro, ausência de
overflow/erros, proporções e carregamento das galerias, origem nos links de
reserva e expansão das informações práticas. HTML/CSS/imagens publicados
foram comparados com os arquivos locais; a home do QR permanece idêntica.

A prova de confiança usa nota 4,7/5 e 787 avaliações, consultadas novamente
pela API do Google em 07/10/2026. A média contempla o conjunto; os seis
destaques são selecionados, não representam a distribuição das notas.
Os recortes de notificações do Gmail, traduzidos e truncados pelo Google,
foram substituídos por cards HTML com trechos originais em português,
nomes públicos, datas e estrelas confirmados pela API: Rafael Morais,
Daniel Vendramin, Daniella Gonçalves, Juliene Pereira, Daniele Rodrigues
e Dante Dola. A seleção cobre pratos, porções para compartilhar, vista,
atendimento e retorno à casa. Cada trecho é uma sequência literal do
comentário original, com até 25 palavras; não corrigir grafia, traduzir,
atribuir frases a outros autores ou simular capturas de tela do Maps.
Os cards são republicações identificadas, não prints do Google. Iniciais
identificam os autores sem inventar retratos. Texto de 16 px sobre fundo
branco sólido nos dois temas; seis cards em três colunas no desktop e
galeria horizontal no celular, sem ocultar o texto por truncagem.
O link leva à ficha pública da mesma unidade da Beira-Mar (CID confirmado).

A credencial persistente do painel é reutilizada com sucesso por
`gestao/scripts/gbp/gbp.py`; nomes e avaliações podem ser lidos pela API
sem pedir tokens temporários. A rotina `google_oauth_helper.py --verificar`
confere esse acesso sem exibir segredos. A resposta bruta e os scripts
temporários ficam apenas no `tmp/` local, fora dos repositórios. Conferir
a presença dos comentários no perfil antes de futuras reutilizações e
atualizar data/nota/quantidade após nova consulta. Instagram continua sendo
o número informado pelo proprietário em 06/10, não uma leitura da API Meta.

O proprietário forneceu fotos de reconhecimento pelo Sebrae no OneDrive
pessoal. Foram inspecionadas: certificado Diamante com o ano 2024, registro
da entrega e troféu com 2025/2026. A página mostra as datas legíveis nas fotos;
nomes de arquivos com 2023/2024 não definem o ciclo do selo. A contagem de
quatro anos consecutivos, inicialmente informada pelo proprietário, deixou
de ser necessária no texto. Não inventar quatro premiações anuais.

As fotografias reais usam miniaturas WebP sem retoque e links para
ampliar os originais. Nenhum texto, rosto, certificado ou data foi reconstruído
por IA. O proprietário informou 41,2 mil seguidores no Instagram em 06/10;
esse número tem data de referência, sem alegar leitura direta da API Meta.
A foto da celebração é o registro de Réveillon já utilizado no site, com legenda
que não promete essa programação musical no atendimento normal.

Após o pedido de menos texto e mais imagens, os blocos explicativos foram
substituídos por fotos e indicadores. A capa usa uma foto única em sua
proporção original; as galerias deslizam no celular e têm três colunas no
desktop. A revisão de 07/10 removeu a seção fechada do Sebrae: certificado,
entrega e troféu ficam visíveis por padrão, com legendas e links para ampliar.
Fotos com 300 px de altura, também limitadas no HTML, enquadradas por imagem
para preservar o certificado completo, os rostos da entrega e o troféu.
No celular, a galeria lateral evita três fotos altas empilhadas. A seção
mediu 635–653 px em 320/390 px e 397 px no desktop de 1440 px.
O texto explica o Selo Sebrae de Qualidade Empresarial, concedido pelo
Sebrae/CE para gestão e qualidade dos serviços, e que Diamante é a categoria
mais alta. Fonte primária vinculada ao lado da explicação:
[Agência Sebrae/CE](https://ce.agenciasebrae.com.br/cultura-empreendedora/empresas-cearenses-recebem-certificacao-do-sebrae-pela-excelencia-da-qualidade-dos-servicos-oferecidos/).
Não confundir com o Selo de Referência em Atendimento das Salas do Empreendedor.
As informações práticas ficam em um `details`, acessível sem JavaScript.
A home do QR não foi alterada. Em 07/10, o proprietário confirmou que a
foto de terraço enviada em Downloads mostra o espaço real e foi fotografada
por ele, com tratamento de cores, nitidez e contraste. Foi publicada na capa
de `/conheca/`, em sua proporção original e sem novos retoques. Variantes
AVIF/WebP de 640 e 960 px, seleção responsiva e preload da imagem efetivamente
exibida evitam servir o PNG de 4 MB. O original continua em Downloads, fora
do Git; versões otimizadas em `assets/img/terraco-por-do-sol-sir-fisher-*`.
A galeria da casa mantém a foto anterior do almoço com vista para o mar.

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
- Bandeiras confirmadas: Visa, Mastercard, Elo, American Express, UnionPay e
  Cabal, além dos principais vales-refeição. As bandeiras dos vales, a entrada
  acessível e o estacionamento acessível ainda precisam de confirmação.
  O atributo de cartões do Google oferece Visa, Mastercard, American Express
  e China UnionPay; esses foram mantidos, e Diners/Discover/JCB desmarcados.
  Elo e Cabal foram informados na descrição, pois não há opções próprias na
  lista retornada pela API. O Google oferece campos separados para Alelo,
  Pluxee, Ticket Restaurante e VR: não marcar todos a partir da expressão
  genérica “principais vales-refeição”. A descrição enviada aguarda processamento
  quando `getGoogleUpdated` informa `pendingMask=profile.description`.
- Comparar descoberta comercial, cliques, rotas, contatos, reservas e visitas
  em períodos fechados. Não atribuir causalidade ou melhora de ranking a uma
  publicação isolada. Esta rotina não cria envios nem automações agendadas.

## Referências

- [Cardápios Google](https://developers.google.com/my-business/content/update-food-menus)
- [Avaliações e QR](https://support.google.com/business/answer/16816815?hl=pt-BR)
- [API da tag Google](https://developers.google.com/tag-platform/gtagjs/reference#get)
- [Consulta Supabase somente de leitura](https://supabase.com/docs/reference/api/v1-read-only-query)
