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
                    docker compose up -d backend frontend

                    docker compose exec -T frontend \
                        wget -qO- http://backend:3000/api/health \
                        > health-response.json

                    grep -q '"ok":true' health-response.json
                    grep -q '"service":"SMART HOUSE"' health-response.json
                    grep -q '"database":"SQLite"' health-response.json

                    cat health-response.json
                '''
                echo 'Prueba de comunicacion entre frontend y backend superada.'
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