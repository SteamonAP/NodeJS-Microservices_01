# SocialP - A Scalable Microservices-Based Social Media Backend

## Overview

SocialP is a robust, fully-featured backend system for a social media application, built from the ground up using a modern, event-driven microservice architecture. This project demonstrates a complete development and deployment lifecycle, from local containerization with Docker to a fully automated CI/CD pipeline deploying to a cloud platform.

The architecture is designed to be highly scalable, resilient, and maintainable, with each business domain handled by its own independent service. Services communicate asynchronously via a message broker (RabbitMQ), ensuring loose coupling and fault tolerance.

---

## Contact

- **Author:** Amogh Pitale
- **Email:** [amoghpitale7@gmail.com](mailto:amoghpitale7@gmail.com)
- **GitHub:** [https://github.com/SteamonAP](https://github.com/SteamonAP)

---

## Core Technologies

- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas (Primary Data Store)
- **Caching:** Upstash Redis (Serverless Cache)
- **Message Broker:** CloudAMQP (RabbitMQ for Asynchronous Communication)
- **Media Storage:** Cloudinary (Image & Video Uploads)
- **Containerization:** Docker, Docker Compose
- **CI/CD:** GitHub Actions
- **Deployment:** Render

---

## System Architecture

The application is composed of five independent microservices, all orchestrated by a central API Gateway.

![Microservice Architecture Diagram](https://i.imgur.com/your-diagram-url.png) <!-- You can create a simple diagram and upload it to imgur to link here -->

| Service            | Port (Local) | Responsibility                                                                                                                                                                         |
| :----------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API Gateway**    | `3000`       | The single entry point for all client requests. Handles authentication (JWT), rate limiting, and routing to downstream services.                                                       |
| **User Service**   | `3001`       | Manages user registration, login, token generation (access & refresh), and user data.                                                                                                  |
| **Post Service**   | `3002`       | Handles CRUD operations for posts. Publishes events (`post.created`, `post.deleted`) to RabbitMQ. Uses Redis for caching post lists.                                                   |
| **Media Service**  | `3003`       | Manages media uploads to Cloudinary and stores media metadata. Subscribes to `post.deleted` events to perform cleanup.                                                                 |
| **Search Service** | `3004`       | Provides full-text search capabilities for posts. Subscribes to `post.created` and `post.deleted` events to keep its search index synchronized. Uses Redis for caching search results. |

---

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- Docker & Docker Compose
- A free account for MongoDB Atlas, Upstash, CloudAMQP, and Cloudinary.

### Local Development Setup

1.  **Clone the repository:**

    ```bash
    git clone [https://github.com/SteamonAP/NodeJS-Microservices_01.git](https://github.com/SteamonAP/NodeJS-Microservices_01.git)
    cd NodeJS-Microservices_01
    ```

2.  **Create `.env` files:**
    Each service folder (`api-gateway`, `user_Id-service`, etc.) requires its own `.env` file. Use the provided `env-files-local` template to create and populate them with your secret keys and credentials. **Ensure all `localhost` URLs are used.**

3.  **Install dependencies for all services:**

    ```bash
    # For api-gateway
    cd api-gateway && npm install && cd ..
    # Repeat for user_Id-service, post-service, media-service, and search-service
    ```

4.  **Run the services:**
    You must start each service in its own separate terminal window.

    ```bash
    # In terminal 1
    cd api-gateway && npm run dev

    # In terminal 2
    cd user_Id-service && npm run dev

    # ... and so on for all 5 services.
    ```

### Docker Setup

1.  **Update `.env` files for Docker:**
    Go into each service's `.env` file and switch the comments: comment out the `localhost` URLs and uncomment the Docker service name URLs (e.g., `RABBITMQ_URL=amqp://rabbitmq:5672`).

2.  **Build and run all containers:**
    From the root directory of the project, run:
    ```bash
    docker-compose up --build
    ```
    This will build all five service images, start a RabbitMQ container, and run the entire application.

---

## API Endpoints

All requests should be sent to the API Gateway (`http://localhost:3000`).

### Authentication

- **`POST /v1/auth/register`**: Create a new user.
- **`POST /v1/auth/login`**: Log in to get an `accessToken` and `refreshToken`.

### Posts

- **`POST /v1/posts/create-post`**: Create a new post (Requires Bearer Token).
- **`GET /v1/posts/all-posts`**: Get a paginated list of all posts (Requires Bearer Token).
- **`DELETE /v1/posts/:id`**: Delete a post you own (Requires Bearer Token).

### Media

- **`POST /v1/media/upload`**: Upload an image. Send as `multipart/form-data` with a key of `file` (Requires Bearer Token).

### Search

- **`GET /v1/search/posts?query=<term>`**: Search for posts containing `<term>` (Requires Bearer Token).

---

## CI/CD Pipeline

This project is configured with a complete CI/CD pipeline using GitHub Actions, located at `.github/workflows/deploy.yml`.

- **Trigger:** The pipeline runs automatically on every `git push` to the `main` branch.
- **Build Job:** It builds a new Docker image for each service and pushes it to a dedicated repository on Docker Hub.
- **Deploy Job:** After the build succeeds, it triggers a rolling deployment for each service on Render using secure deploy hooks. This ensures a zero-downtime update process.
