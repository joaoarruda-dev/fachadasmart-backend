# Deploy do backend

Custo fixo alvo: R$ 0. Imagens no Cloudflare R2 e API no Google Cloud Run, ambos no plano gratuito.

| Peça | Onde | Endereço |
| --- | --- | --- |
| API | Google Cloud Run (`us-central1`) | URL `*.run.app` (depois: `api.fachadasmart.com`) |
| Imagens geradas | Cloudflare R2, bucket `previas` | `https://previas.fachadasmart.com` |

## 1. Cloudflare R2 (uma vez)

1. O domínio `fachadasmart.com` precisa estar com o DNS na Cloudflare.
2. R2 → **Create bucket** → nome `previas`, localização automática.
3. Bucket `previas` → **Settings → Custom Domains → Connect domain** → `previas.fachadasmart.com`.
   Não use o endereço `r2.dev` em produção: ele tem limite de requisições.
4. Bucket `previas` → **Settings → Object lifecycle rules** → apagar objetos com mais de **90 dias**.
5. R2 → **Manage API tokens → Create API token** → permissão *Object Read & Write*, só no bucket `previas`.
   Guarde o *Access Key ID*, o *Secret Access Key* e o *Account ID*.

## 2. Supabase (uma vez)

1. SQL Editor → New query → cole `supabase/001_acesso.sql` → Run.
2. Authentication → URL Configuration: Site URL `https://fachadasmart.com`; Redirect URLs `https://fachadasmart.com/auth/callback` e `http://localhost:3000/auth/callback`.
3. Authentication → SMTP: configure um provedor (ex.: Resend). O e-mail padrão do Supabase só envia para membros da equipe do projeto.
4. Liberar um cliente: Table Editor → `profiles` → `status = active` (cota padrão: 50 prévias e 50 limpezas por mês).

## 2b. Google Cloud (uma vez)

1. Crie o projeto (ex.: `fachada-smart`) e vincule a conta de faturamento.
2. **Billing → Budgets & alerts** → orçamento de **R$ 20/mês** com alerta em 50%, 90% e 100%.
3. Instale o `gcloud` e rode:
   ```bash
   gcloud auth login
   gcloud config set project fachada-smart
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```

## 3. Variáveis de produção

Crie `backend/.env.cloudrun.yaml` (já ignorado pelo git) a partir deste modelo:

```yaml
OPENAI_KEY: "sk-..."
OPENAI_MODEL: "gpt-5.6-sol"
GEMINI_API_KEY: "..."
CORS_ORIGIN: "https://fachadasmart.com,https://www.fachadasmart.com"
R2_ACCOUNT_ID: "..."
R2_ACCESS_KEY_ID: "..."
R2_SECRET_ACCESS_KEY: "..."
R2_BUCKET: "previas"
R2_PUBLIC_URL: "https://previas.fachadasmart.com"
SUPABASE_URL: "https://ibmdedjbigxkkxekgtpr.supabase.co"
SUPABASE_SERVICE_ROLE_KEY: "sb_secret_..."   # secreta: Supabase → Project Settings → API Keys
```

Não defina `PORT`: o Cloud Run define sozinho.

## 4. Deploy

Na pasta `backend`:

```bash
gcloud run deploy fachada-smart-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file .env.cloudrun.yaml \
  --memory 512Mi --cpu 1 \
  --timeout 300 \
  --concurrency 10 \
  --min-instances 0 --max-instances 2
```

- `--max-instances 2` limita o gasto se alguém abusar da API antes do login existir.
- `--min-instances 0` mantém o custo zero quando ninguém usa (a primeira chamada leva alguns segundos a mais).
- O comando imprime a URL do serviço (`https://fachada-smart-api-....run.app`). Ela vai no front como `NEXT_PUBLIC_API_URL`.

## 5. Conferir

```bash
curl -X POST "$URL/api/orcamento" -H "Content-Type: application/json" \
  -d '{"itens":[{"materialId":"acm","largura_m":5,"altura_m":1.2}]}'
```

No log do Cloud Run deve aparecer `Imagens: R2 (previas)`. Se aparecer `disco local`, falta alguma variável `R2_*`.
No Postman, troque `baseUrl` pela URL do Cloud Run e rode a pasta "Validações (sem custo)".
