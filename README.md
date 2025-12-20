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
