# Part 12: Docker Deployment (ECS & ECR)

## 12.1 What are Docker and ECS?

**Docker** allows you to package your Spring Boot or React application, along with its runtime, system tools, and system libraries, into a standardized unit for software development called a *Container*.

**Amazon Elastic Container Service (ECS)** is a highly scalable, high-performance container orchestration service that supports Docker containers. It allows you to easily run and scale containerized applications on AWS without having to manage the underlying EC2 instances directly (using AWS Fargate serverless compute).

**Amazon Elastic Container Registry (ECR)** is a fully managed container registry that makes it easy to store, manage, and deploy Docker container images (AWS's private version of Docker Hub).

## 12.2 Why Use Containers on AWS?

Without Docker, your EC2 Java deployments are subject to the "it works on my machine" problem. Perhaps your local machine has Java 17 installed, but the EC2 instance has Java 11. With Docker, the exact same environment runs locally as it does on AWS. ECS then takes those immutable containers and scales them up and down seamlessly, handling restarts if a container crashes.

## 12.3 Practical Implementation: Deploying Spring Boot to ECS

### Step 1: Create a Dockerfile

In the root of your Spring Boot project, create a file named `Dockerfile`:

```dockerfile
# Use official Java 17 runtime as a parent image
FROM eclipse-temurin:17-jre-alpine
# Set the working directory
WORKDIR /app
# Copy the executable jar
COPY target/my-spring-app-0.0.1-SNAPSHOT.jar app.jar
# Expose the API port
EXPOSE 8080
# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Step 2: Push Image to AWS ECR

1. Open AWS Console -> search for **Elastic Container Registry (ECR)** -> **Create repository**. Name it `spring-boot-repo`.
2. Open your local terminal, authenticate the Docker client to your ECR registry, build, tag, and push the image. AWS provides these exact commands when you click **View push commands** in the console:

```bash
# Authenticate
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Build the local Docker image
docker build -t spring-boot-repo .

# Tag it for AWS
docker tag spring-boot-repo:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/spring-boot-repo:latest

# Push to ECR
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/spring-boot-repo:latest
```

### Step 3: Deploy to ECS (Using Fargate)

1. Open **Elastic Container Service (ECS)** -> **Task Definitions** -> **Create new Task Definition**.
2. Select **AWS Fargate** (Serverless compute for containers, no EC2 management!).
3. **Container details:** Name `spring-boot-container`, Image URI: (copy from ECR), Port mappings: `8080`.
4. Click **Create**.
5. Go to **Clusters** -> **Create Cluster**. Name it `spring-boot-cluster`.
6. Inside your cluster, create a **Service**.
7. **Launch type:** Fargate.
8. **Task definition:** Select the one you just created.
9. **Networking:** Select your VPC and Subnets. Assign a Security Group that allows inbound port 8080. Enable **Public IP**.
10. Click **Create Service**. ECS will now pull your Docker image and run it globally.

## 12.4 Common Mistakes

- **OOM (Out of Memory) Kills:** Allocating 512MB of RAM to a Fargate task running a heavy Spring Boot application will crash instantly. Ensure your Fargate task has at least 1GB - 2GB of RAM defined.

---

# Part 13: CI/CD Pipeline (CodePipeline)

## 13.1 What is CI/CD?

**Continuous Integration and Continuous Deployment (CI/CD)** automates your software delivery process. Instead of manually building a `.jar` locally and copying it to a server, every time you `git push` code to GitHub, AWS automatically downloads the code, runs the tests, compiles it, builds a Docker image, and deploys it to your ECS cluster or EC2 instances.

## 13.2 CI/CD Stack on AWS

- **AWS CodeCommit:** Fully-managed source control service (like GitHub).
- **AWS CodeBuild:** Fully managed continuous integration service that compiles source code, runs tests, and produces software packages.
- **AWS CodeDeploy:** Automates code deployments to any instance, including Amazon EC2 instances and on-premises servers.
- **AWS CodePipeline:** Fully managed continuous delivery service that automates your release pipelines for fast and reliable updates. It glues everything above together.

## 13.3 Practical Implementation: GitHub to EC2 Pipeline

### Step 1: Prepare the Add `appspec.yml`

CodeDeploy requires an `appspec.yml` file in your project root to know how to install the app.

```yaml
version: 0.0
os: linux
files:
  - source: /target/app.jar
    destination: /home/ec2-user/
hooks:
  ApplicationStop:
    - location: scripts/stop_server.sh
      timeout: 300
      runas: root
  ApplicationStart:
    - location: scripts/start_server.sh
      timeout: 300
      runas: root
```

You must also include `start_server.sh` and `stop_server.sh` shell scripts in your repo.

### Step 2: Create a CodePipeline

1. Go to AWS Console -> **CodePipeline** -> **Create pipeline**.
2. **Name:** `spring-boot-pipeline`.
3. **Source provider:** Select **GitHub (Version 2)**. Connect to your GitHub account and select your repository and `main` branch.
4. **Build provider:** Select **AWS CodeBuild**.
   - Create a new Build Project.
   - Select Managed image (Ubuntu / standard).
   - In your repo, you must include a `buildspec.yml` telling CodeBuild how to compile Java:
     ```yaml
     version: 0.2
     phases:
       build:
         commands:
           - mvn clean package
     artifacts:
       files:
         - target/app.jar
         - appspec.yml
         - scripts/**/*
     ```
5. **Deploy provider:** Select **AWS CodeDeploy**.
   - You must quickly create a CodeDeploy application and Deployment Group pointing to your EC2 instances (identified by tags, e.g., `Env:Prod`).
6. Click **Create pipeline**.

Now, every single `git push` to `main` will automatically trigger a build and zero-downtime deployment!

## 13.4 Interview Questions

**Q: In Blue/Green deployments using CodeDeploy, what does Blue and Green represent?**
*Answer:* Blue represents the currently running production environment. Green represents the newly deployed version. Traffic is gradually shifted from Blue to Green. If the Green environment fails health checks, traffic is instantly routed back to Blue.

---

# Part 14: AWS CloudWatch (Monitoring)

## 14.1 What is CloudWatch?

**Amazon CloudWatch** is a monitoring and observability service. It provides you with data and actionable insights to monitor your applications, respond to system-wide performance changes, and optimize resource utilization.

## 14.2 Core Concepts

- **Metrics:** Data points related to your resources (e.g., EC2 CPU utilization, ALB HTTP 500 error count, RDS disk space remaining).
- **Alarms:** Watch a single metric over a time period and perform one or more actions (like sending an email or triggering Auto Scaling) if the metric exceeds a threshold.
- **Logs:** Collect, monitor, and store log files from your EC2 instances, AWS CloudTrail, Route 53, and other sources.

## 14.3 Real-World Production Use Cases

- Creating dashboards for the CEO displaying the exact number of active users connected to the Load Balancer.
- Setting an Alarm to page the DevOps team at 3 AM if the Spring Boot API returns more than ten 500 Internal Server Errors in a 5-minute window.
- Viewing raw Spring Boot application logs centrally, rather than SSHing into 10 different EC2 instances separately to read `app.log`.

## 14.4 Practical Implementation: Viewing Logs and Creating an Alarm

### Step 1: View Logs (Fargate/ECS Auto-Integration)
If you deploy your Spring Boot container using ECS Fargate, logging is handled instantly.
1. Open the ECS cluster and click your Task.
2. Under the **Logs** tab, every `System.out.println()` and `logger.info()` from your Java app streams directly to CloudWatch Logs automatically. No configuration needed!

### Step 2: Create an Alarm for CPU Spike
1. Go to **CloudWatch** -> **Alarms** -> **Create alarm**.
2. Click **Select metric**.
3. Go to **EC2** -> **Per-Instance Metrics** -> Find your production instance and select `CPUUtilization`.
4. **Conditions:** Select **Greater/Equal**, Threshold value: **80%**. Period: **5 minutes**.
5. **Actions:** Under Notification, select "Create a new topic", enter your email address (e.g., `admin@company.com`).
6. Name the alarm `High-CPU-Alert` and click **Create alarm**. You will receive an email confirmation. Now, whenever the server spikes, you will be notified instantly.

## 14.5 Common Mistakes
- **Logging Sensitive Data:** Logging credit card numbers or raw unhashed passwords to standard out in Spring Boot. CloudWatch logs are stored in plain text and accessible by anyone in the company with CloudWatch Read access.
- **Unbounded Log Retention:** By default, CloudWatch Logs are retained "Never expire". For a high-traffic API, this will cost thousands of dollars a month in storage fees after a year. Always configure existing log groups to have a retention period of 14 or 30 days.
