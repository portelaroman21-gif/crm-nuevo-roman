# CRM Román Portela

Un CRM que abre en el día y te dice qué hacer. Cuatro listas, bloques con las
tareas adentro, y números que se cuentan solos.

- **Backend** Node 22 + Express, base **Postgres** (`pg`)
- **Frontend** React + Vite, **ya compilado** en `backend/publico`
- **Deploy** Docker, pensado para EasyPanel

---

## Por qué el frontend va compilado en el repositorio

Normalmente no se sube el resultado de un build. Acá sí, a propósito.

Compilar el frontend necesita cerca de 1 GB de RAM. En el VPS, con todo lo que
ya corre, ese pico tumbó el panel la primera vez. Con el frontend ya compilado,
el servidor sólo baja cuatro paquetes de JavaScript puro: el deploy pasa de
minutos y 1 GB a segundos y casi nada.

**Si tocás algo de `frontend/src`, hay que recompilar antes de subir:**

```bash
cd frontend
npm install
npm run build        # deja el resultado en backend/publico
cd ..
git add backend/publico
git commit -m "frontend actualizado"
git push
```

Si no tocás el frontend, no hace falta hacer nada de esto.

---

## Deploy en EasyPanel

### 1. La base de datos

En tu proyecto: **Create Service → Postgres**. Llamalo `crm-db` y anotá el
usuario, la contraseña y el nombre de la base.

### 2. La aplicación

**Create Service → App**.

| Campo | Valor |
|---|---|
| **Source** | GitHub → este repositorio, rama `main` |
| **Build** | Dockerfile — ruta `Dockerfile` |
| **Port** | `3000` |

En **Environment**, dos variables:

```
DATABASE_URL=postgres://usuario:clave@HOST:5432/base
JWT_SECRET=una-cadena-larga-y-al-azar
```

- El `DATABASE_URL` es la *Internal Connection URL* que muestra el servicio de
  Postgres. El host es el nombre interno del servicio (algo como
  `miproyecto_crm-db`), **nunca** `localhost`.
- Si la clave tiene caracteres raros hay que codificarlos en la URL:
  `%` → `%25`, `@` → `%40`, `/` → `%2F`, `$` → `%24`.
- Para el secreto: `openssl rand -hex 32`.

Después, **Domains** → tu dominio al puerto `3000`, y **Deploy**.

Las tablas se crean solas la primera vez. Si Postgres todavía está levantando,
la app espera y reintenta hasta doce veces antes de rendirse.

La primera vez que entres te pide crear tu usuario. Es la única vez.

### 3. Opcional: respaldos en archivo

Postgres ya tiene los suyos. Si además querés una copia en JSON, montá un
**Volume** en `/respaldos`: deja una copia por día y guarda las últimas 14.

---

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | sí | Conexión a Postgres |
| `JWT_SECRET` | sí | Firma la sesión. Si la cambiás, hay que entrar de nuevo |
| `PORT` | no | Por defecto `3000` |
| `RESPALDOS_DIR` | no | Dónde dejar las copias JSON. Por defecto `/respaldos` |
| `MAPA_CLAVE` | no | Clave del webhook del mapa. Si no, se genera desde Ajustes |

En vez de `DATABASE_URL` también sirven `PGHOST`, `PGPORT`, `PGUSER`,
`PGPASSWORD` y `PGDATABASE`. Para una base con SSL obligatorio (Neon), agregá
`?sslmode=require` al final de la URL.

No hay variables de WhatsApp: el sistema no se conecta a WhatsApp.

---

## El webhook del mapa

`mapa.romanportela.com` avisa cuando pasa algo:

```
POST https://<tu-dominio>/api/mapa/evento
X-Clave: <la clave de Ajustes → Mapa>
Content-Type: application/json

{
  "tipo": "registro",
  "nombre": "Luciano Rossi",
  "empresa": "Rossi Desarrollos",
  "rol": "Director",
  "telefono": "1199887766",
  "tipoLote": "esquina 800m2",
  "zona": "San Miguel centro"
}
```

`tipo` puede ser `registro`, `lote_guardado` o `visita`. El registro crea la
ficha en Desarrolladores con un seguimiento para hoy; los otros dos suben a esa
persona al frente de la cola. El teléfono es la llave: si ya existe, no se
duplica la ficha.

---

## Correr local

```bash
createdb crm

cd backend
npm install
DATABASE_URL=postgres://postgres@localhost:5432/crm JWT_SECRET=loquesea npm start
```

Para trabajar en el frontend con recarga en vivo, en otra terminal:

```bash
cd frontend
npm install
npm run dev
```

---

## Cómo está armado

```
Dockerfile              imagen final, sin compilar nada
backend/
  server.js             arranque, rutas, archivos estáticos
  db.js                 Postgres: pool, esquema y capa de consultas
  lib/
    fechas.js           todo en hora de Argentina (UTC-3, sin horario de verano)
    personas.js         las cuatro listas, el teléfono como llave, la cola
    dia.js              bloques, plantilla, agenda que reacomoda el día
    contadores.js       los siete números del End of Day
    ia.js               el asistente (cualquier proveedor tipo OpenAI)
    respaldo.js         copia diaria en JSON
    ruta.js             router que atrapa errores asincrónicos
    auth.js             JWT y la puerta de sesión
    semilla.js          la plantilla inicial del día típico
  routes/               una por sección de la API
  publico/              el frontend compilado (ver arriba)
frontend/src/           el código del frontend
```
