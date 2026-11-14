FROM jenkins/jenkins:lts-jdk21

USER root

RUN apt-get update \
    && apt-get install -y docker.io docker-compose \
    && rm -rf /var/lib/apt/lists/*

RUN usermod -aG root jenkins

USER jenkins