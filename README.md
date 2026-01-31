# TJHub Tracker - Guia de Configuração

## Visão Geral
Este script realiza o rastreamento de eventos de scroll, cliques, formulários e outros dados de navegação para integração com Google Analytics 4 (GA4) e backend próprio.

## Configuração Básica

### Inclusão do Script
Adicione o script no seu HTML:
```html
<script async src="https://tjhub-tracker.pages.dev/track.js?site_id=SEU_SITE_ID&ga_id=SEU_GA4_ID"></script>
```
- `site_id`: Identificador único do site.
- `ga_id`: Measurement ID do GA4 (ex: G-XXXXXXXXXX).

### Eventos de Scroll
- O evento `vertical_scroll` é enviado apenas se o usuário atingir uma nova profundidade máxima (múltiplo de 10%) **e permanecer com a página em foco por 5 segundos**.
- O evento `scroll_depth` é enviado ao sair da página, registrando a maior profundidade atingida.

## Como alterar para marcar a cada 20% de scroll
Se quiser que o evento `vertical_scroll` seja enviado apenas a cada 20% (em vez de 10%), altere este trecho no arquivo `track.js`:

```javascript
// Troque esta linha:
const roundedDepth = Math.floor(currentDepth / 10) * 10;
// Por esta:
const roundedDepth = Math.floor(currentDepth / 20) * 20;
```

Assim, os eventos serão enviados apenas em 20%, 40%, 60%, 80%, 100%.

## Recomendações
- Mantenha o tempo de foco ajustado conforme o engajamento desejado (padrão: 5 segundos).
- Sempre utilize o parâmetro `ga_id` para garantir que os eventos sejam enviados para a propriedade correta do GA4.
- Consulte o DebugView do GA4 para validar o recebimento dos eventos customizados.

## Suporte
Em caso de dúvidas ou para personalizações, entre em contato com o desenvolvedor responsável pelo TJHub Tracker.
# TJHub Tracker

Este repositório contém o código do script de rastreamento de eventos do TJHub.

## Estrutura de Arquivos

-   `track.dev.js`: Este é o arquivo de **desenvolvimento**. Ele contém o código-fonte completo, comentado e não minificado. Todas as alterações e novas funcionalidades devem ser feitas aqui.
-   `track.js`: Este é o arquivo de **produção**. É uma versão minificada do `track.dev.js`, otimizada para ser carregada rapidamente nos sites dos clientes. **Não edite este arquivo diretamente.**

## Processo de Desenvolvimento

1.  **Desenvolva**: Faça todas as alterações necessárias no arquivo `track.dev.js`.
2.  **Minifique**: Antes de enviar para produção, você precisa minificar o `track.dev.js` para criar a versão final do `track.js`. Você pode usar qualquer ferramenta online ou local para isso. Uma sugestão é o [Terser](https://terser.org/):
    -   Copie o conteúdo de `track.dev.js`.
    -   Cole no minificador.
    -   Copie o resultado minificado e substitua o conteúdo de `track.js`.
3.  **Deploy**: Faça o deploy do arquivo `track.js` atualizado.
