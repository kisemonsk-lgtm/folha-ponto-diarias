# Folha de Ponto — Diárias

Sistema de folha de ponto para pagamento de diárias, feito para **celular e tablet**, com cálculo automático do valor a receber, tema claro/escuro, edição, exclusão e geração de relatório.

É um site estático (HTML + CSS + JavaScript puro), sem instalação e sem servidor. Os dados ficam salvos no próprio aparelho (localStorage do navegador).

## Funcionalidades

- Layout adaptável para celular e tablet, com botões grandes e fáceis de tocar
- Dois temas: claro e escuro, com botão para alternar (a escolha fica memorizada)
- Registrar ponto escolhendo data e tipo: dia integral ou meia diária
- Editar qualquer registro salvo (data, tipo de dia e valor)
- Excluir registro, com confirmação
- Selecionar o valor vigente: R$ 80 / R$ 40 (antigo) ou R$ 100 / R$ 50 (reajustado)
- Lista completa: data, dia da semana, tipo de dia, período e valor
- Total acumulado a receber e subtotal separado por período de pagamento
- Relatório para baixar no aparelho: TXT, CSV (planilha) e PDF (pela impressão)
- Backup e restauração dos dados em JSON
- Valores sempre no formato `R$ X,XX`

## Regras de valores e períodos

- Pagamento de 15 em 15 dias, começando no dia 5 de cada mês:
  - Período 1: dia **05** ao dia **19**
  - Período 2: dia **20** ao dia **04** do mês seguinte
- Valor antigo: diária integral **R$ 80,00** | meia diária **R$ 40,00**
- Valor reajustado: diária integral **R$ 100,00** | meia diária **R$ 50,00**
- A data do reajuste é configurável na tela (padrão: 15/11/2026). Registros anteriores a ela usam R$ 80 / R$ 40; a partir dela, R$ 100 / R$ 50.
- Registros já incluídos de início: dia 05 → meia diária R$ 40,00 e dia 06 → dia integral R$ 80,00 (valor antigo).

## Como usar

### Abrir localmente
Basta abrir o arquivo `index.html` no navegador (celular, tablet ou computador).

### Publicar no GitHub Pages
1. Suba este repositório no GitHub.
2. Vá em **Settings → Pages**.
3. Em *Source*, escolha **Deploy from a branch** → branch `main` → pasta `/ (root)`.
4. Salve. O site fica disponível em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

Também é possível instalar no celular pelo menu do navegador ("Adicionar à tela de início"), pois não há dependências externas.

## Estrutura

```
index.html    Interface (marcação da tela)
estilo.css    Estilos, temas claro/escuro e layout responsivo
app.js        Regras de cálculo, períodos, persistência e relatórios
```

## Aviso sobre os dados

Os dados ficam na memória do navegador **daquele aparelho**. Se abrir em outro celular ou limpar os dados do navegador, os registros não aparecem. Use **Exportar backup** com frequência para guardar uma cópia.
