# One image: React build -> Spring Boot JAR (serves the SPA and the API). Used by Render.
FROM node:20-alpine AS web
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
COPY backend/src/main/resources /src/backend/src/main/resources
RUN npm run build

FROM maven:3.9-eclipse-temurin-21 AS jar
WORKDIR /src/backend
COPY backend/pom.xml ./
RUN mvn -q -B dependency:go-offline
COPY backend/src ./src
COPY --from=web /src/backend/src/main/resources/static ./src/main/resources/static
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=jar /src/backend/target/agro-portal.jar app.jar
COPY backend/model ./model
ENV JAVA_OPTS="-Xmx384m -XX:+UseSerialGC"
EXPOSE 8080
CMD ["sh", "-c", "java $JAVA_OPTS -Dserver.port=${PORT:-8080} -jar app.jar"]
