# Part 1: Introduction to Cloud Computing

## 1.1 What is Cloud Computing?

Cloud computing is the on-demand delivery of IT resources (compute power, database storage, applications, and other IT resources) over the Internet with pay-as-you-go pricing. Instead of buying, owning, and maintaining physical data centers and servers, companies can access computing power and storage on an as-needed basis from a cloud provider like Amazon Web Services (AWS).

## 1.2 Why Companies Use Cloud Computing

Before the cloud, companies had to forecast their IT needs months or years in advance. They had to buy hardware, rack and stack servers, and physically wire data centers.

**Key benefits of the cloud:**
- **Agility:** Cloud gives you easy access to a broad range of technologies so you can innovate faster.
- **Elasticity:** You don't have to over-provision resources up front to handle peak levels of business activity. You can provision the amount of resources you actually need and scale them up or down instantly.
- **Cost Savings:** The cloud allows you to trade fixed expenses (such as data centers and physical servers) for variable expenses, and only pay for IT as you consume it.
- **Deploy Globally in Minutes:** You can easily deploy your application in multiple physical locations around the world with just a few clicks.

## 1.3 Traditional Hosting vs. Cloud Infrastructure

| Feature | Traditional On-Premises | Cloud Infrastructure |
|---------|------------------------|----------------------|
| **Capital Expense** | High initial investment (CapEx) | Zero upfront cost, pay-as-you-go (OpEx) |
| **Scaling** | Manual, slow (weeks/months) | Automated, instant (Auto Scaling) |
| **Maintenance** | Your team manages hardware/power | Cloud provider manages physical hardware |
| **Security** | You build physical security fencing | Provider has military-grade data centers |
| **Deployment** | Slow, manual rack stacking | Infrastructure as Code (Terraform/CloudFormation) |

## 1.4 Cloud Service Models Explained

Cloud computing comes in three primary service models, representing different levels of abstraction and shared responsibility.

### 1. IaaS (Infrastructure as a Service)
**What it is:** You rent raw IT infrastructure—servers, virtual machines, storage, networks, and operating systems. You are responsible for managing the OS, middleware, and applications.
**Example:** AWS EC2 (Elastic Compute Cloud), S3, VPC.
**Real-World Use Case:** A company wants total control over their Linux environment to run a custom-compiled database engine.

### 2. PaaS (Platform as a Service)
**What it is:** The provider manages the underlying infrastructure (usually hardware and operating systems), allowing you to focus purely on the deployment and management of your applications.
**Example:** AWS Elastic Beanstalk, Heroku, AWS RDS (Relational Database Service).
**Real-World Use Case:** A developer wants to deploy a Spring Boot `.jar` file without having to install Java, configure Tomcat, or patch the underlying Linux OS.

### 3. SaaS (Software as a Service)
**What it is:** A complete product that is run and managed by the service provider. You only use the software, usually via a web browser.
**Example:** Gmail, Salesforce, DropBox.
**Real-World Use Case:** A company uses Gmail for corporate email instead of managing their own Microsoft Exchange servers.

```text
+-------------------------------------------------------------+
|               Cloud Service Models Comparison               |
+-------------------------------------------------------------+
|                                                             |
|   You Manage             You Manage           You Manage    |
|   [ ] Applications       [ ] Applications     [x] Nothing!  |
|   [ ] Data               [ ] Data             [x] Nothing!  |
|   [ ] Runtime            [x] AWS Manages      [x] AWS       |
|   [ ] Middleware         [x] AWS Manages      [x] AWS       |
|   [ ] O/S                [x] AWS Manages      [x] AWS       |
|   [x] AWS Manages        [x] AWS Manages      [x] AWS       |
|   [x] AWS Manages        [x] AWS Manages      [x] AWS       |
|                                                             |
|       IaaS                   PaaS                 SaaS      |
|     (e.g., EC2)        (e.g., Beanstalk)     (e.g., Gmail)  |
+-------------------------------------------------------------+
```

---

# Part 2: AWS Overview

## 2.1 What is AWS?

Amazon Web Services (AWS) is the world's most comprehensive and broadly adopted cloud platform, offering over 200 fully featured services from data centers globally. It provides highly reliable, scalable, low-cost infrastructure platforms in the cloud that power hundreds of thousands of businesses in 190 countries.

## 2.2 Global Infrastructure

AWS operates a massive global network infrastructure. Understanding this topology is critical for designing highly available and fault-tolerant full-stack applications.

### Regions
**What they are:** A Region is a physical, geographical location in the world where AWS clusters its data centers (e.g., `us-east-1` in N. Virginia, `ap-south-1` in Mumbai).
**Why they matter:** You choose a Region based on data compliance laws, latency (closeness to your users), and service availability.
**Rule of Thumb:** Regions are completely isolated from one another. If an earthquake destroys a Region, applications in other Regions remain completely unaffected.

### Availability Zones (AZs)
**What they are:** Every Region consists of multiple, isolated, and physically separate AZs (usually 3 or more). An AZ is one or more discrete data centers with redundant power, networking, and connectivity.
**Why they matter:** To build a highly available Spring Boot backend, you must deploy your application instances across *multiple* AZs within a Region. If one AZ goes down (due to power failure, flood), the other AZs keep serving traffic.

### Edge Locations
**What they are:** Datacenters used specifically to cache content closer to end users to reduce latency. There are vastly more Edge Locations than Regions worldwide.
**Why they matter:** Edge Locations are the foundation of AWS CloudFront (Content Delivery Network). When you deploy a compiled React application (HTML/CSS/JS), you distribute it to Edge Locations so users globally can download the UI in milliseconds.

## 2.3 Global Architecture Diagram

```text
+---------------------------------------------------------------+
|                       AWS GLOBAL NETWORK                      |
+---------------------------------------------------------------+
|                                                               |
|   REGION: us-east-1 (N. Virginia)                             |
|   +-------------------------------------------------------+   |
|   |  AZ: us-east-1a         AZ: us-east-1b                |   |
|   |  +----------------+     +----------------+            |   |
|   |  | Data Center 1  |     | Data Center 3  |            |   |
|   |  | Data Center 2  |     | Data Center 4  |            |   |
|   |  +----------------+     +----------------+            |   |
|   |          \                     /                      |   |
|   |           \                   /                       |   |
|   |            \                 /                        |   |
|   |        High-speed, low-latency fiber                  |   |
|   +-------------------------------------------------------+   |
|                                                               |
|   EDGE LOCATIONS (Global Caching via CloudFront)              |
|   [London]  [Tokyo]  [Mumbai]  [Sydney]  [Sao Paulo]          |
|                                                               |
+---------------------------------------------------------------+
```

---

# Part 3: AWS Account Setup (Practical)

Before deploying a Spring Boot and React stack, the very first step in AWS is establishing a secure administrative account.

## 3.1 Create an AWS Account

1. Go to `aws.amazon.com` and create an AWS account.
2. Provide billing information (AWS requires a credit card even for the Free Tier).
3. The email you use to register becomes your **Root Account**.

## 3.2 Securing the Root Account

**Common Mistake:** *Never* use your Root Account for daily development or application deployment. The Root Account has unrestricted, unstoppable access to everything, including billing.

1. Log into the AWS Management Console as the Root user.
2. Search for **IAM** (Identity and Access Management).
3. Under the IAM Dashboard, locate the "Add MFA" warning.
4. **Enable MFA (Multi-Factor Authentication):** Register a virtual MFA device (like Google Authenticator or Authy on your phone). Scan the QR code, enter two consecutive tokens.
5. Once MFA is enabled, log out, and you will almost never use the Root account again.

## 3.3 Create an IAM Admin User for Daily Use

Instead of the Root account, you interact with AWS using an IAM User.

1. In the IAM Dashboard (logged in as Root, one last time), click **Users** -> **Add users**.
2. **User name:** `admin-user` (or your name).
3. **Select AWS access type:** Check both "Programmatic access" (for CLI/API) and "AWS Management Console access".
4. **Set permissions:** Click "Attach existing policies directly" -> Select `AdministratorAccess`.
5. **Review and create.**
6. **CRITICAL:** Download the `.csv` file containing the `Access key ID` and `Secret access key`. You will need this for the AWS CLI. *Never share this or commit it to GitHub.*

## 3.4 Configure the AWS CLI

To deploy Docker containers, configure CI/CD loops, or script infrastructure, developers use the AWS CLI.

### Step 1: Install the AWS CLI

**For Windows (PowerShell):**
```powershell
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi
```

**For macOS (Terminal):**
```bash
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
```

**For Linux:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### Step 2: Configure Credentials

Open your terminal and run:

```bash
aws configure
```

You will be prompted to enter the credentials from the CSV file you downloaded earlier:

```bash
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-east-1
Default output format [None]: json
```

### Step 3: Verify Connection

Test that your CLI can talk to AWS by listing your IAM users:

```bash
aws iam list-users
```

If it returns a JSON block with your `admin-user`, your setup is complete and secure. You are now ready to start deploying real applications!
