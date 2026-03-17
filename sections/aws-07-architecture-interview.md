# Part 15: Full Production Architecture

This architecture represents the gold standard for deploying a highly available, scalable, fault-tolerant React + Spring Boot + MySQL full-stack application.

## 15.1 Enterprise Cloud Architecture Diagram

```text
+-----------------------------------------------------------------------------------------+
|                                    INTERNET Users                                       |
+-----------------------------------------------------------------------------------------+
            |                                         | 
            v  (Static React App)                     v  (API Requests)
    +-----------------------+                 +-----------------------+
    |    AWS CloudFront     |                 |  Amazon API Gateway   |
    | (Global Edge Network) |                 | (Rate Limiting/Auth)  |
    +-----------------------+                 +-----------------------+
            |      ^                                  |
            |      |                                  v
            v      |                         [Application Load Balancer]
       +-----------------+                            |
       |    Amazon S3    |                            | (Routes to healthy instances)
       | (Hosts React &  |                            |
       |  Static Assets) |                            v
       |                 |                  +-------------------+
       |  [File Uploads]-|----------------->| Auto Scaling Group|
       +-----------------+                  |  [Spring Boot]    | <----+
                |                           |  [Spring Boot]    |      | Logs
                v (Event Trigger)           +-------------------+      |
       +-----------------+             (Private Connectivity) |        |
       |   AWS Lambda    |                                    |        |
       | (Image Resizer, |        +------------------------+  |        |
       |  Webhook pushes)|        v                        v  v        v
       +-----------------+  +-------------------+  +-------------------+
                            |    Amazon RDS     |  | Amazon CloudWatch |
                            |  (Master MySQL)   |  | (Logs & Alarms)   |
                            +-------------------+  +-------------------+
                                      | (Sync Replication)
                                      v
                            +-------------------+ 
                            | Amazon RDS (Standby)| 
                            | (Different AZ)    | 
                            +-------------------+ 
```

## 15.2 Component Breakdown

1. **Amazon S3:** Stores the compiled, optimized build of your React frontend app. Also stores raw user file uploads.
2. **AWS CloudFront:** A globally distributed CDN that caches the React S3 bucket contents across hundreds of Edge Locations globally, delivering sub-millisecond load times.
3. **AWS Lambda:** Short-lived Serverless functions that trigger instantly when an image is uploaded to S3 to create thumbnails without placing CPU burden on the backend.
4. **Amazon API Gateway:** Exposes your backend REST APIs. Protects internal microservices by enabling API Keys, Throttling (Rate Limiting), and integrating with AWS Cognito for authentication.
5. **Application Load Balancer:** Distributes API requests received from the API Gateway evenly across multiple EC2 or ECS Spring Boot instances.
6. **Auto Scaling Group / ECS Fargate:** The compute layer running your Spring Boot application across *multiple* Availability Zones. If CPU > 70%, it scales out automatically.
7. **Amazon RDS MySQL (Multi-AZ):** Stores all user and application data. If the master database fails, traffic instantly shifts to the synchronous standby database in a different AZ with zero data loss.
8. **CloudWatch:** Aggregates logs from Spring Boot and Lambda, monitors Error Rates, and tracks metric alarms (e.g., if RDS CPU hits 90%).

---

# Part 16: Interview Preparation (50+ AWS Questions)

The following real-world interview questions prepare developers for Senior Cloud Engineering positions.

### **Core Concepts**

**1. What is AWS?**
Amazon Web Services (AWS) is a highly scalable, flexible, and cost-effective cloud computing platform that provides reliable and scalable cloud computing services globally.
**2. What are the key elements of AWS global infrastructure?**
Regions, Availability Zones (AZs), and Edge Locations.
**3. What is an Availability Zone?**
An isolated location within an AWS Region consisting of one or more discrete data centers.
**4. What is a Region?**
A geographical area containing two or more Availability Zones.
**5. What is an Edge Location?**
Endpoints used by AWS CloudFront caching systems to deliver content with low latency globally.
**6. What are the different types of cloud services?**
IaaS (Infrastructure), PaaS (Platform), SaaS (Software).
**7. Explain the AWS Shared Responsibility Model.**
AWS is responsible for security *of* the cloud (physical data centers, network). The customer is responsible for security *in* the cloud (IAM users, configuring Security Groups, encrypting data).

### **Compute & Scalability**

**8. What is Amazon EC2?**
Elastic Compute Cloud provides scalable virtual servers in the cloud.
**9. How do you secure an EC2 instance?**
Using Security Groups (firewall), Key Pairs (SSH), and placing it in a Private Subnet.
**10. What is an AMI?**
Amazon Machine Image. A template that provides the OS and applications required to launch an EC2 instance.
**11. What is an Elastic IP address?**
A static, public IPv4 address that does not change when an EC2 instance stops and starts.
**12. On-Demand vs Reserved vs Spot instances?**
On-Demand: Pay by the hour, no commitment. Reserved: 1-3 year commitment for massive discount. Spot: Bid on unused AWS capacity for up to 90% discount, but can be terminated with a 2-minute warning.
**13. What is AWS Auto Scaling?**
Automatically adjusts the number of EC2 instances based on traffic or load (e.g., CPU utilization).
**14. Horizontal vs Vertical Scaling in AWS?**
Horizontal (Scale Out/In) adds/removes EC2 instances. Vertical (Scale Up/Down) increases/decreases instance size (e.g., `t3.micro` to `c5.xlarge`). AWS Auto Scaling handles Horizontal scaling.
**15. What is a Load Balancer (ELB)?**
Distributes incoming application traffic across multiple EC2 instances to increase fault tolerance.
**16. ALB vs NLB?**
Application Load Balancer operates at Layer 7 (HTTP/HTTPS) and routes based on URL paths. Network Load Balancer operates at Layer 4 (TCP/UDP) for extreme performance and static IPs.

### **Storage & Database**

**17. What is Amazon S3?**
Simple Storage Service. A highly scalable, durable object storage service.
**18. What is the durability of S3?**
99.999999999% (11 nines).
**19. What is a Bucket Policy?**
A JSON document attached to an S3 bucket that controls access permissions across the entire bucket.
**20. Difference between S3 and EBS?**
S3 is object storage (like a limitless hard drive in the sky access via API). EBS (Elastic Block Store) is block storage representing a literal hard drive directly attached to a specific EC2 instance.
**21. What is an S3 Pre-signed URL?**
A temporary URL generated using AWS credentials that grants temporary access to download or upload an object securely.
**22. What is Amazon RDS?**
Relational Database Service. A managed service for MySQL, PostgreSQL, Oracle, etc.
**23. What is Amazon DynamoDB?**
A fully managed, fast NoSQL database service with single-digit millisecond performance at any scale.
**24. Multi-AZ vs Read Replicas in RDS?**
Multi-AZ is for synchronous Disaster Recovery (High Availability). Read Replicas are for asynchronous Read Scaling (Performance).

### **Networking (VPC)**

**25. What is Amazon VPC?**
Virtual Private Cloud. A private, isolated section of the AWS cloud where you define your networking architecture.
**26. Public vs Private Subnet?**
A public subnet has a route to an Internet Gateway (IGW). A private subnet does not.
**27. What is an Internet Gateway (IGW)?**
Allows compute instances in a public subnet to connect to the internet.
**28. What is a NAT Gateway?**
Allows instances in a private subnet to securely reach the internet to download updates without allowing inbound traffic from the internet.
**29. Security Group vs Network ACL (NACL)?**
Security groups operate at the Instance level (Stateful). NACLs operate at the Subnet level (Stateless).

### **Security & IAM**

**30. What is IAM?**
Identity and Access Management. Controls secure access to AWS services.
**31. Difference between IAM User and IAM Role?**
A User has permanent credentials (password, access key). A Role provides temporary, short-lived credentials intended to be assumed by an EC2 instance or service.
**32. What is an IAM Policy?**
A JSON document defining permissions (Allow/Deny actions on resources).
**33. What is AWS CloudTrail?**
A service that logs every single API call made in your AWS account for auditing and compliance.
**34. How do you securely pass AWS credentials to a Spring Boot app on EC2?**
Attach an IAM Role directly to the EC2 instance. The AWS SDK in Spring Boot automatically assumes the role via Instance Metadata. *Never* hardcode access keys.

### **Docker, ECS, and Serverless**

**35. What is Amazon ECS?**
Elastic Container Service. A managed container orchestration service to run Docker containers.
**36. ECS EC2 Launch Type vs ECS Fargate?**
With EC2 Launch Type, you manage the underlying EC2 instances executing the containers. With Fargate, AWS completely abstracts the servers; you just specify CPU/RAM for the container (Serverless Compute).
**37. What is Amazon ECR?**
Elastic Container Registry. AWS’s private managed Docker container registry.
**38. What is AWS Lambda?**
A Serverless compute service that runs code (Java, Node.js, Python) in response to events and automatically manages the computing resources required.

### **CI/CD & Monitoring**

**39. What are the Code suite services?**
CodeCommit (Git source control), CodeBuild (compiling/testing), CodeDeploy (deploying to EC2), CodePipeline (orchestrates the flow).
**40. What is Amazon CloudWatch?**
A monitoring service for logging, metrics, and alarms.
**41. How does Spring Boot log to CloudWatch?**
Standard output (`System.out.println` or Logback console appender) running inside an ECS Fargate container automatically streams directly to a CloudWatch Log Group.

### **Serverless (Lambda)**

**42. What is AWS Lambda?**
A Serverless compute service that runs code (Java, Node.js, Python) in response to events and automatically manages the computing resources required.
**43. What does "Serverless" architecture mean?**
It means the cloud provider dynamically manages the allocation and provisioning of servers. You only pay for exactly what you use right down to the millisecond of execution time, rather than paying for idle EC2 servers 24/7.
**44. What is a Lambda trigger?**
An AWS service or event (like an S3 file upload, API Gateway HTTP request, or EventBridge cron schedule) that invokes a Lambda function to execute.
**45. Why might you use Node.js or Python instead of Java for a Lambda function?**
Lambda functions suffer from "Cold Starts"—the time it takes for AWS to provision a new container. A JVM takes significantly longer to start than Node.js or Python, leading to high latency spikes on the first invocation.

### **Scenario-Based Technical Questions**

**46. A Spring Boot instance keeps crashing with OutOfMemoryExceptions. How do you diagnose it?**
Check CloudWatch Logs for the exact stack trace. Check CloudWatch Metrics to map memory spikes. Increase EC2/ECS memory limits if under-provisioned.
**47. Your Application Load Balancer returns a 502 Bad Gateway. Why?**
The backend EC2 instances are offline, misconfigured, or not returning a valid HTTP payload within the ALB timeout period.
**48. Users are complaining the React app loads slowly in Asia, but fast in the US. Solution?**
Host the React app statically in an S3 bucket and distribute it globally via the CloudFront CDN edge network.
**49. Your EC2 instance cannot connect to the internet to download Java. Why?**
If in a private subnet, there is no NAT Gateway configured in the route table. If in a public subnet, missing an Elastic IP or the IGW is missing from the route table.
**50. How would you handle processing 50,000 images uploaded to S3 by users simultaneously?**
Use AWS Lambda triggered by S3 PutObject events. Lambda will automatically horizontally scale out to 50,000 parallel Execution Environments instantly, processing them all concurrently without burdening the Spring Boot backend servers.

---

# Part 17: AWS Production Best Practices

To confidently run real-world enterprise applications in the cloud, implement these five pillars of AWS Architecture:

## 1. Security
- Use IAM Roles instead of Access Keys everywhere.
- Enable MFA on root and administrator accounts.
- Encrypt your RDS databases and S3 buckets at rest using AWS KMS.
- Keep EC2 instances entirely in Private Subnets with no public IPs.

## 2. Reliability (High Availability)
- Always launch backend EC2/ECS instances into an Auto Scaling Group across at least 2 Availability Zones.
- Always run production RDS in Multi-AZ mode to survive database failure.
- Offload static assets (images, frontend React apps) to S3 + CloudFront so they never impact backend reliability.

## 3. Performance Efficiency
- Implement read replicas on RDS for heavy reporting queries.
- Optimize Java JVM memory settings (Heap size) specifically for your instance type.
- Use CloudFront to globally cache API payloads closer to the end user.

## 4. Cost Optimization
- Set up AWS Billing Alarms to prevent bill shock.
- For non-production environments (Dev/Test), use Spot Instances to save 90% on compute cost.
- Configure S3 Lifecycle rules to move 30-day-old files to cheaper S3 Glacier storage.

## 5. Operational Excellence
- Adopt Infrastructure as Code (Terraform or AWS CloudFormation) so your entire architecture is reproducible via code instead of clicking through the AWS Console manually.
- Consolidate all central application errors into CloudWatch Alarms that ping Slack or PagerDuty instantly.
