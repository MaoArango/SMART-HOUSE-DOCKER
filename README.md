# SMART HOUSE – Aplicación contenerizada

## 1. Descripción

SMART HOUSE es una aplicación web inmobiliaria desarrollada con Node.js y SQLite. Este proyecto académico implementa dos servicios mediante Docker: un backend para la lógica de la aplicación y un frontend con Nginx como proxy inverso.

## 2. Arquitectura

- **Backend:** Node.js, puerto interno 3000.
- **Frontend:** Nginx, puerto 80 del contenedor, publicado en el puerto 8080 del equipo.
- **Orquestación:** Docker Compose.
- **Red:** smart-house-network (bridge).
- **Persistencia:** volúmenes Docker para datos y archivos.

## 3. Requisitos

- Docker Desktop.
- Docker Compose.
- Git.

## 4. Variables de entorno

Consultar `.env.example`. La aplicación utiliza `PORT=3000` por defecto. No publicar archivos `.env` con información sensible.

## 5. Ejecución

Construir las imágenes e iniciar los servicios:

```bash
docker compose up -d --build
```

Consultar el estado:

```bash
docker compose ps
```

Abrir la aplicación:

http://localhost:8080

## 6. Verificación de comunicación

Probar conectividad desde frontend hacia backend:

```bash
docker exec smart-house-frontend ping -c 4 backend
```

Verificar el endpoint de salud:

```bash
docker exec smart-house-frontend wget -qO- http://backend:3000/api/health
```

Respuesta esperada:

```json
{"ok":true,"service":"SMART HOUSE","database":"SQLite"}
```

## 7. Detener los servicios

```bash
docker compose down
```

Los volúmenes nombrados se conservan al detener los servicios con este comando.

## 8. Repositorio

https://github.com/MaoArango/SMART-HOUSE-DOCKER

## 9. Propósito

Proyecto desarrollado como actividad académica del módulo Integración Continua del Politécnico Grancolombiano.