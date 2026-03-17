# Part 4: EC2 (Virtual Servers)

## 4.1 What is AWS EC2?

**Amazon Elastic Compute Cloud (EC2)** provides scalable computing capacity in the AWS cloud. Simply put, it allows you to rent virtual servers (called instances) on which you can install your operating system, software, and deploy your Spring Boot or React applications.

## 4.2 Why Does EC2 Exist?

Before EC2, launching a new server meant ordering physical hardware, waiting weeks for delivery, racking the server, installing the OS, and plugging in network cables. EC2 eliminates this overhead. You can provision hundreds of virtual servers with varying capacities in seconds and shut them down when no longer needed, paying only for the time they run.

## 4.3 Key EC2 Concepts

- **Instance Types:** EC2 instances come in different families optimized for specific use cases (e.g., Compute Optimized, Memory Optimized, General Purpose). Example: `t3.micro` is good for small web apps, `c5.large` is for CPU-heavy processing.
- **AMI (Amazon Machine Image):** A template containing the software configuration (OS, application server, applications) required to launch an instance. Example: Amazon Linux 2, Ubuntu 22.04.
- **Security Groups:** A virtual firewall that controls inbound and outbound traffic to your EC2 instance. You explicitly open ports (like port 22 for SSH, port 8080 for Spring Boot).
- **Key Pairs:** Used to prove your identity when connecting to an EC2 instance. AWS stores the public key, and you store the private key (`.pem` file) locally to SSH into the box.
- **Elastic IP:** A static IPv4 address designed for dynamic cloud computing. If an EC2 instance restarts, its public IP changes. An Elastic IP remains constant.

## 4.4 Real-World Production Use Cases

- Hosting a legacy monolithic Spring Boot application.
- Standing up a dedicated Jenkins or GitLab CI/CD server.
- Running background batch processing jobs using Spring Batch.
- Deploying a self-managed database (if not using RDS).

## 4.5 Practical Implementation: Deploying Spring Boot on EC2

This guide deploys a compiled Spring Boot `.jar` file exposed on port 8080.

### Step 1: Launch the EC2 Instance

1. Open the AWS Console and search for **EC2**.
2. Click **Launch Instance**.
3. **Name:** Give your instance a name like `SpringBoot-Backend`.
4. **AMI:** Select **Amazon Linux 2023 AMI**.
5. **Instance Type:** Select `t2.micro` or `t3.micro` (Free Tier eligible).
6. **Key Pair:** Click **Create new key pair**. Name it `spring-boot-key`, choose `RSA` and `.pem`. Download and save it securely.

### Step 2: Configure the Security Group

We must allow SSH (to access the server) and HTTP/8080 (for our Spring Boot API).

1. Under **Network settings**, click **Edit**.
2. **Auto-assign Public IP:** Ensure "Enable".
3. **Inbound Security Group Rules:**
   - **Type:** SSH, **Protocol:** TCP, **Port Range:** 22, **Source:** Anywhere/My IP
   - **Type:** Custom TCP, **Protocol:** TCP, **Port Range:** 8080, **Source:** Anywhere

4. Click **Launch Instance**. Wait ~30 seconds for it to start.

### Step 3: Connect via SSH

Find the public IP address of your new instance from the EC2 Dashboard.

Open your terminal (on Mac/Linux) or PowerShell (Windows). Change the permissions of your `.pem` key (Mac/Linux only):

```bash
chmod 400 spring-boot-key.pem
```

Now, SSH into the instance:

```bash
ssh -i "spring-boot-key.pem" ec2-user@<YOUR-EC2-PUBLIC-IP>
```

### Step 4: Install Java 17

Once logged into your EC2 terminal:

```bash
sudo yum update -y
sudo yum install java-17-amazon-corretto -y
java -version
```

### Step 5: Upload and Run the Spring Boot JAR

Open a **separate** local terminal (do not run this inside the EC2 SSH session) to copy your built Spring Boot `.jar` to the server using `scp`:

```bash
scp -i "spring-boot-key.pem" target/my-spring-app-0.0.1-SNAPSHOT.jar ec2-user@<YOUR-EC2-PUBLIC-IP>:~/app.jar
```

Switch back to your EC2 SSH terminal and run the app:

```bash
# Run the application in the background using nohup
nohup java -jar app.jar > app.log 2>&1 &
```

Your Spring Boot application is now running globally! Test it by opening a browser and navigating to `http://<YOUR-EC2-PUBLIC-IP>:8080`.

## 4.6 Common Mistakes Developers Make

- **Losing the Key Pair:** If you lose the `.pem` file, you cannot SSH into your instance. AWS does not store a copy.
- **Wide Open Security Groups:** Leaving port 22 (SSH) open to `0.0.0.0/0` (the entire internet) is a massive security risk. Restrict it to your personal IP.
- **Hardcoding AWS Credentials:** Never hardcode AWS keys inside your Spring Boot `application.properties`. Use IAM Roles instead.

## 4.7 Interview Questions

**Q: What is the difference between an On-Demand instance and a Spot instance?**
*Answer:* On-Demand instances have fixed, predictable pricing, ideal for uninterrupted workloads. Spot instances use spare AWS capacity and provide massive discounts (up to 90%), but AWS can terminate them with a 2-minute warning. They are best for fault-tolerant background jobs.

**Q: If you stop and start an EC2 instance, what happens to its IP address?**
*Answer:* Its public IP address will change unless an Elastic IP is attached. The private IP address remains the same.

---

# Part 5: Elastic Load Balancing (ELB)

## 5.1 What is an Elastic Load Balancer?

An Elastic Load Balancer (ELB) automatically distributes incoming application traffic across multiple targets, such as EC2 instances, containers, or IP addresses, in one or more Availability Zones.

## 5.2 Why Does It Exist?

If you deploy your Spring Boot backend to a single EC2 instance, you have two massive problems:
1. **Single Point of Failure:** If the instance crashes, your entire API goes offline.
2. **Scalability Ceiling:** A single instance can only handle so much CPU load before slowing down.

By placing a Load Balancer in front of *multiple* EC2 instances, traffic gets distributed evenly. If one instance crashes, the LB detects the failure (via health checks) and reroutes traffic to healthy instances.

## 5.3 Types of Load Balancers

- **Application Load Balancer (ALB):** Operates at Layer 7 (HTTP/HTTPS). Best for web applications like Spring Boot APIs and React apps. It can route traffic based on URL paths (e.g., `/api/v1/*` goes to backend group, `/static/*` goes to frontend group).
- **Network Load Balancer (NLB):** Operates at Layer 4 (TCP/UDP). Best for ultra-high performance, gaming servers, or handling millions of requests per second with microsecond latency.

## 5.4 Architecture Diagram

```text
+-------------------------------------------------------------+
|               APPLICATION LOAD BALANCER (ALB)               |
+-------------------------------------------------------------+
|                                                             |
|                         [ Users ]                           |
|                             |                               |
|                     (HTTP Requests)                         |
|                             v                               |
|                +-------------------------+                  |
|                | Application Load Balancer|                  |
|                +-------------------------+                  |
|                    /                  \                     |
|                   /                    \                    |
|          +--------------+        +--------------+           |
|          | AZ: us-east-1a|       | AZ: us-east-1b|           |
|          | EC2 Instance 1|       | EC2 Instance 2|           |
|          | (Active)      |       | (Active)      |           |
|          +--------------+        +--------------+           |
|                                                             |
+-------------------------------------------------------------+
```

## 5.5 Practical Implementation: Setting up an ALB

Before starting, ensure you have *two* EC2 instances running your Spring Boot application in two different Availability Zones.

### Step 1: Create a Target Group
A Target Group tells the ALB *where* to route traffic.

1. Go to EC2 Dashboard -> **Target Groups** -> **Create target group**.
2. **Target type:** Instances.
3. **Target group name:** `spring-boot-tg`.
4. **Protocol/Port:** HTTP / 8080 (Matches your Spring Boot app).
5. **Health check path:** `/actuator/health` (Assuming Spring Boot Actuator is enabled).
6. Register the two running EC2 instances into this group and click **Include as pending below**.

### Step 2: Create the Load Balancer

1. Go to EC2 Dashboard -> **Load Balancers** -> **Create Load Balancer**.
2. Select **Application Load Balancer**.
3. **Name:** `spring-boot-alb`.
4. **Scheme:** Internet-facing.
5. **Network mapping:** Select at least two subnets in different Availability Zones.
6. **Security Groups:** Create/Select a security group that allows inbound HTTP on port 80.
7. **Listeners and routing:** For the HTTP:80 listener, select your `spring-boot-tg` target group.
8. Click **Create**.

### Step 3: Test Scaling

Once the ALB is provisioned (takes ~2 minutes), copy its DNS Name (e.g., `spring-boot-alb-1234.us-east-1.elb.amazonaws.com`). Paste this into your browser. The ALB will seamlessly route traffic to your backend servers!

## 5.6 Interview Questions

**Q: What is a Health Check in Load Balancing?**
*Answer:* A mechanism where the ALB continuously pings a specific endpoint (like `/health`) on the EC2 instances. If an instance stops responding with a HTTP 200 OK status, the ALB marks it as unhealthy and stops routing traffic to it.

**Q: Does an ALB have a static IP address?**
*Answer:* No. An Application Load Balancer uses dynamic IPs that update over time as it scales internally to handle traffic volume. You must always refer to an ALB by its DNS Name. (Conversely, an NLB *can* use static Elastic IPs).

---

# Part 6: Auto Scaling

## 6.1 What is Auto Scaling?

**AWS Auto Scaling** monitors your applications and automatically adjusts capacity to maintain steady, predictable performance at the lowest possible cost. When traffic spikes, Auto Scaling adds EC2 instances (Scale Out). When traffic drops, it removes instances (Scale In).

## 6.2 Why Does It Exist?

Traffic is rarely constant. An e-commerce site might have 1,000 users at 3 AM and 100,000 users at 5 PM.
If you manually provision 50 servers to handle the 5 PM spike, you are wasting massive amounts of money at 3 AM. Auto Scaling ensures you only pay for exactly what you need at any given second.

## 6.3 Auto Scaling Concepts

- **Launch Template:** A blueprint that defines the configuration for the instances that Auto Scaling launches (AMI, Instance Type, Key Pair, Security Groups, and User Data script).
- **Auto Scaling Group (ASG):** The logical collection of EC2 instances managed together. It has a Minimum, Maximum, and Desired capacity.
- **Scaling Policies:** Rules that trigger scaling actions. (e.g., "Add 2 instances if average CPU > 70% for 5 minutes").

## 6.4 Practical Implementation: Auto Scaling a Spring Boot API

### Step 1: Create a Launch Template

1. In the EC2 console, click **Launch Templates** -> **Create launch template**.
2. **Name:** `spring-boot-lt`.
3. Provide the AMI (e.g., Amazon Linux 2023), Instance type (`t3.micro`), Key pair, and Security Group (allow SSH and 8080).
4. **Advanced details -> User Data:** This is a crucial bash script that runs automatically when the EC2 instance boots. Add a script to install Java and download/run your jar on startup:

```bash
#!/bin/bash
yum update -y
yum install java-17-amazon-corretto -y
# Download jar from S3 (Requires IAM Role with S3 read access)
aws s3 cp s3://my-artifacts-bucket/app.jar /home/ec2-user/app.jar
nohup java -jar /home/ec2-user/app.jar > /home/ec2-user/app.log 2>&1 &
```
5. Click **Create launch template**.

### Step 2: Create Auto Scaling Group

1. Click **Auto Scaling Groups** -> **Create Auto Scaling group**.
2. **Name:** `spring-boot-asg`.
3. Select your `spring-boot-lt` launch template.
4. Select your VPC and check all Availability Zones.
5. **Load Balancing:** Attach to the existing Application Load Balancer target group (`spring-boot-tg`) created in Part 5.
6. **Group Size:** Desired: 2, Minimum: 2, Maximum: 5.
7. **Scaling Policies:** Choose "Target tracking scaling policy". Metric: Average CPU utilization. Target value: 60%.

### Step 3: Test Scaling

To test, you can SSH into an EC2 instance and run a stress tool to max out the CPU. Once the CPU artificially hits 100%, AWS Auto Scaling will detect the breach of the 60% policy, automatically provision a new EC2 instance, install Java via the User Data script, and attach it to the Load Balancer!

## 6.5 Interview Questions

**Q: What is the difference between Vertical Scaling and Horizontal Scaling? Which does AWS Auto Scaling do?**
*Answer:* Vertical scaling (Scaling Up) means upgrading an existing server to a larger instance type (e.g., increasing RAM/CPU). Horizontal scaling (Scaling Out) means adding more servers of the same size to distribute load. AWS Auto Scaling groups perform **Horizontal Scaling**. Horizontal scaling combined with stateless REST APIs is the key to massive cloud architecture.

**Q: If an instance launched by an ASG crashes, what happens?**
*Answer:* The ASG constantly performs health checks. If an instance goes down, the Desired Capacity drops below the target. The ASG automatically terminates the dead instance and spins up a brand new, identical instance to replace it, ensuring high availability.
