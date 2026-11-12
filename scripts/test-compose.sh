#!/bin/sh
set -eu

echo "=== Construyendo e iniciando los servicios ==="
docker compose up -d --build

cleanup() {
  echo "=== Deteniendo los servicios de prueba ==="
  docker compose down
}
trap cleanup EXIT

echo "=== Esperando la respuesta del backend ==="

attempt=0
until docker compose exec -T frontend wget -qO- http://backend:3000/api/health >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "ERROR: El backend no responde desde frontend."
    exit 1
  fi
  sleep 2
done

echo "=== Verificando comunicación HTTP por nombre de servicio ==="

response=$(docker compose exec -T frontend wget -qO- http://backend:3000/api/health)

echo "$response"

echo "$response" | grep -q '"ok":true'
echo "$response" | grep -q '"service":"SMART HOUSE"'
echo "$response" | grep -q '"database":"SQLite"'

echo "=== PRUEBA EXITOSA: frontend se comunica con backend ==="