# Presença no Google e medição

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

As reservas criadas usam data de criação no fuso de Fortaleza; comparecimentos
usam data da visita. Esses números não formam uma coorte de conversão direta.
Primeiro comparecimento **registrado** não comprova primeira visita à casa.
Não usar valores estimados dos eventos como faturamento apurado.

Em 06/10/2026, `click_menu` deixou de ser evento principal no GA4. Continua
sendo coletado como evento de intenção. Reservas, comparecimentos e eventos
de contato existentes foram preservados. A mudança afeta comparações futuras
de engajamento; não altera retroativamente os relatórios antigos.

Na home em português e inglês, SDKs de marketing aguardam a primeira pintura.
As filas Meta/OpenAI são criadas imediatamente; os SDKs esperam o `load`
da página (a primeira interação antecipa), com limite de espera de 3 s
(desde 07/10/2026). GA4 continua assíncrono desde
o início. Testes verificam preservação de PageView e ausência de SDK duplicado.
Essa priorização pode afetar usuários que saem antes de qualquer SDK carregar;
não comparar pixels e sessões GA4 como se tivessem cobertura idêntica.

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
A home do QR não foi alterada. A foto de terraço enviada em Downloads tem
prévia apenas local; sua origem e fidelidade ao espaço aguardam confirmação
antes de usá-la como fotografia real na página pública.

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
