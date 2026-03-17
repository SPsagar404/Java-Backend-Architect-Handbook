# Part 9: Amazon VPC (Networking)

## 9.1 What is Amazon VPC?

**Amazon Virtual Private Cloud (VPC)** lets you provision a logically isolated section of the AWS Cloud where you can launch AWS resources in a virtual network that you define. You have complete control over your virtual networking environment, including selection of your own IP address range, creation of subnets, and configuration of route tables and network gateways.

## 9.2 Why Does It Exist?

Without a VPC, if you launched an EC2 instance or an RDS database, it would sit directly on the open internet, vulnerable to hackers globally. A VPC allows you to build a secure, private fence around your backend servers and databases. 

## 9.3 Core VPC Architecture Concepts

- **VPC (Virtual Private Cloud):** The overarching network boundaries defined by a large CIDR block (e.g., `10.0.0.0/16` gives 65,536 private IPs).
- **Subnets:** Smaller chunks of the VPC deployed inside a specific Availability Zone.
- **Public Subnet:** A subnet that has a route to the internet. This is where you put your Application Load Balancers.
- **Private Subnet:** A subnet that does *not* have direct access to the internet. This is where your Spring Boot EC2 instances and RDS databases go. If they need internet packages (like `yum install java`), they route through a NAT.
- **Internet Gateway (IGW):** The front door attached to the VPC that allows public subnets to communicate with the outside world.
- **NAT Gateway (Network Address Translation):** Placed exactly in the public subnet. It allows resources in *private* subnets to invisibly reach out to the internet to download updates, but prevents the internet from initiating a connection backwards into the private subnet.

## 9.4 Full Custom VPC Architecture Diagram

```text
+-------------------------------------------------------------+
|               Amazon VPC (10.0.0.0/16)                      |
|                                                             |
|   +-------------------+          [ Internet Gateway (IGW) ] |
|   | Public Subnet     |                 |                   |
|   | 10.0.1.0/24      <------------------+                   |
|   |                   |                                     |
|   | +---------------+ |          +-----------------------+  |
|   | | Load Balancer | |--------->| NAT Gateway (Static IP)| |
|   | +---------------+ |          +-----------------------+  |
|   +---------|---------+                      |              |
|             v                                |              |
|   +-------------------+                      |              |
|   | Private Subnet    |                      |              |
|   | 10.0.2.0/24       |                      |              |
|   |                   |                      v              |
|   |  [ Spring Boot ]----------------[Route out to NAT]      |
|   |  [ EC2 Instance]  |                                     |
|   |         |         |                                     |
|   +---------|---------+                                     |
|             v                                               |
|   +-------------------+                                     |
|   | Private Subnet    |                                     |
|   | 10.0.3.0/24       |                                     |
|   |                   |                                     |
|   | [ RDS MySQL  ]    |                                     |
|   | [ Database   ]    |                                     |
|   +-------------------+                                     |
+-------------------------------------------------------------+
```

## 9.5 Practical Implementation: Creating a Production VPC

For production, never use the default VPC. Use the **VPC Wizard** to properly secure your stack:

1. Open VPC Dashboard -> **Create VPC**.
2. Select **VPC and more**. This provisions the entire network routing topology instantly.
3. **Name tag auto-generation:** `Spring-Boot-Prod-VPC`.
4. **IPv4 CIDR block:** `10.0.0.0/16`.
5. **Number of Availability Zones (AZs):** 2 (For High Availability).
6. **Number of public subnets:** 2 (For our Load Balancer to span both AZs).
7. **Number of private subnets:** 4 (Two for Spring Boot EC2s, Two for RDS).
8. **NAT gateways:** `In 1 AZ` (Cheaper) or `1 per AZ` (More robust). Required to allow private EC2s to `yum update`.
9. Click **Create VPC**.

From this point forward, when launching EC2 instances or RDS databases, explicitly place them inside the **Private Subnets** of `Spring-Boot-Prod-VPC`.

## 9.6 Interview Questions

**Q: What is the difference between a Security Group and a Network ACL (NACL)?**
*Answer:* A Security Group acts at the **Instance level**, is Stateful (if traffic is allowed in, the response is automatically allowed out), and rules evaluate all traffic. A NACL acts at the **Subnet level**, is Stateless (you must explicitly allow inbound AND outbound traffic separately), and evaluates rules sequentially starting from rule #100.

**Q: Can a private IP from inside a VPC reach the internet?**
*Answer:* Yes, but only if the subnet routetable sends traffic `0.0.0.0/0` to a NAT Gateway attached to a public subnet holding an Elastic IP.

---

# Part 10: AWS IAM (Identity and Access Management)

## 10.1 What is IAM?

**AWS Identity and Access Management (IAM)** helps you securely control access to AWS resources. You use IAM to control who is authenticated (signed in) and authorized (has permissions) to use resources.

## 10.2 Core IAM Concepts

- **User:** Represents a human or service connecting to AWS. Users have long-term credentials (password or Access Keys).
- **Group:** A collection of users. If you put 10 developers in an "Admin" group, they all instantly receive Administrator privileges.
- **Policies:** JSON documents attached to users/groups/roles defining exactly what actions are allowed/denied.
- **Roles:** Like a "hat" that an AWS service (like EC2) can wear temporarily to gain permissions to speak to another AWS service (like S3). Roles provide short-lived temporary credentials, replacing dangerous hardcoded access keys.

## 10.3 Understanding IAM JSON Policies

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::user-images-bucket/*"
    }
  ]
}
```
**Effect:** Is this allowing or denying access?
**Action:** What exact API call is being made? (e.g. upload to S3).
**Resource:** Which exact bucket/server is allowed? 

## 10.4 Real-World Vulnerability

**A massive security mistake in Spring Boot applications:**
A developer builds an app that uploads files to S3. They generate an Access Key for an IAM User and paste it into `src/main/resources/application.properties`. They accidentally `git push` that file to a public GitHub repository. Within 35 seconds, automated bots scrape GitHub, find the keys, log into AWS, and spin up $50,000 worth of Bitcoin mining EC2 instances.

**The Solution:** Use IAM Roles attached to EC2.

## 10.5 Practical Implementation: Allowing EC2 to Access S3 Securely using Roles

Instead of hardcoding AWS credentials in your Spring Boot application to allow it to generate Pre-signed URLs or upload directly via the SDK, AWS provides magical temporary credentials under the hood utilizing IAM Roles.

### Step 1: Create the IAM Role

1. Open IAM Dashboard -> **Roles** -> **Create role**.
2. **Trusted entity type:** AWS Service.
3. **Use case:** EC2.
4. Click **Next**.
5. **Add permissions:** Search for `AmazonS3FullAccess` and select it.
6. Click **Next**, Name the role `SpringBoot-EC2-S3-Access-Role`.
7. Click **Create role**.

### Step 2: Attach Role to Running EC2 Instance

1. Open the EC2 Dashboard.
2. Check the box next to your running Spring Boot instance.
3. Click **Actions** -> **Security** -> **Modify IAM role**.
4. Select `SpringBoot-EC2-S3-Access-Role` from the dropdown list.
5. Click **Update IAM role**.

### Step 3: Application Configuration

Because the EC2 instance now physically "wears" the IAM Role, the underlying AWS SDK operating on the instance intercepts the Role credentials natively from the EC2 instance metadata service. You DO NOT provide `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` to Spring Boot at all. The SDK authenticates itself instantly and seamlessly.

## 10.6 Interview Questions

**Q: You want to give an external vendor temporary access to your S3 bucket. Should you create an IAM User for them?**
*Answer:* No. You should use AWS STS (Security Token Service) combined with an IAM Role (or Cross-Account Roles via AssumeRole mechanism) to grant temporary, expiring access rather than creating a permanent user.

**Q: If an explicit DENY policy and an explicit ALLOW policy conflict on an IAM User, which one wins?**
*Answer:* Explicit DENY always trumps ALLOW in AWS IAM policy evaluation logic.
