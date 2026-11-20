# SuperIPs - Gestor e Scanner de Rede e Endereçamento IP

## 1. Objetivo e Finalidade
Sistema completo para documentação, monitoramento e mapeamento de faixas de IP, equipamentos e roteadores de rede corporativa.

## 2. Tecnologias Utilizadas
- React, TypeScript, Vite, Node.js/Express (Backend), Tailwind CSS, Capacitor (Android/Mobile), LibSQL / Turso, Docker

## 3. Arquitetura e Estrutura de Diretórios
Monorepo full-stack contendo frontend React/Vite com suporte a compilação nativa Android via Capacitor e backend Node.js (`server/`) com banco de dados LibSQL.

## 4. Principais Arquivos e Responsabilidades
- `server/`: API backend com rotas de gestão de rede e scanner.
- `src/`: Interface SPA com tabelas dinâmicas de IPs e status de conectividade.
- `capacitor.config.ts`: Configuração para build de aplicativo móvel Android.
- `docker-compose.yml`: Implantação rápida dos serviços em containers.

## 5. Funcionalidades Identificadas
- Tabela de endereçamento com indicação de IPs livres, fixos e em conflito
- Cadastro e categorização de switches, servidores, câmeras e PDVs
- Aplicativo móvel compilável para técnicos de campo com Capacitor
- Suporte a sincronização com banco LibSQL em nuvem

## 6. Como Compilar ou Executar
```bash
# Frontend
npm run dev:frontend
# Backend
npm run dev:backend
```

## 7. Estado Atual do Projeto
**Completo**

## 8. Pendências e Limitações Identificadas
Implementar módulo de ping ICMP automático em segundo plano.
