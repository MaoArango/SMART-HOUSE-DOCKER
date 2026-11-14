pipeline {
    agent any

    options {
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                echo 'Codigo fuente obtenido correctamente.'
            }
        }

        stage('Build') {
            steps {
                sh '''
                    docker compose build backend frontend
                '''
                echo 'Imagenes Docker construidas correctamente.'
            }
        }

        stage('Test') {
            steps {
                sh '''
                    set -eu

                    PROJECT="smart-house-test-${BUILD_NUMBER}"
                    COMPOSE_TEST="docker-compose.test.yml"

                    cleanup() {
                        docker compose -p "$PROJECT" \
                            -f "$COMPOSE_TEST" down --remove-orphans \
                            >/dev/null 2>&1 || true
                    }

                    trap cleanup EXIT

                    cat > "$COMPOSE_TEST" <<'EOF'
services:
  backend:
    image: smart-house-ci-backend:latest
    environment:
      PORT: 3000
    expose:
      - "3000"

  frontend:
    image: smart-house-ci-frontend:latest
    depends_on:
      - backend
EOF

                    echo "Iniciando servicios de prueba con Docker Compose..."

                    docker compose -p "$PROJECT" \
                        -f "$COMPOSE_TEST" up -d --no-build

                    echo "Esperando comunicacion entre servicios..."

                    READY=0

                    for i in $(seq 1 30); do
                        if docker compose -p "$PROJECT" \
                            -f "$COMPOSE_TEST" exec -T frontend \
                            wget -qO- http://backend:3000/api/health \
                            > health-response.json 2>/dev/null; then
                            READY=1
                            break
                        fi
                        sleep 2
                    done

                    if [ "$READY" -ne 1 ]; then
                        echo "ERROR: No fue posible consultar el backend."
                        docker compose -p "$PROJECT" \
                            -f "$COMPOSE_TEST" logs
                        exit 1
                    fi

                    grep -q '"ok":true' health-response.json
                    grep -q '"service":"SMART HOUSE"' health-response.json
                    grep -q '"database":"SQLite"' health-response.json

                    cat health-response.json

                    echo "Prueba de comunicacion con Docker Compose superada."
                '''
            }
        }
    }

    post {
        success {
            echo 'Integracion continua SMART HOUSE: EXITOSA.'
        }
        failure {
            echo 'Integracion continua SMART HOUSE: FALLIDA.'
        }
    }
}