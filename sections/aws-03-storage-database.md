# Part 7: S3 (Simple Storage Service)

## 7.1 What is AWS S3?

**Amazon Simple Storage Service (S3)** is an object storage service offering industry-leading scalability, data availability, security, and performance. Unlike a file system (which stores data in folders) or block storage (which stores chunks of data on hard drives), S3 stores data as *objects* within globally unique containers called *buckets*.

## 7.2 Why Does S3 Exist?

Traditional hard drives fill up. If you build a social media application and users upload 5 terabytes of images, an EC2 EBS volume will eventually run out of space, forcing you to manually attach a new drive. With S3, storage is infinitely scalable. You never have to provision disk space. You pay only for what you use, and the data is automatically replicated across multiple servers for 99.999999999% durability.

## 7.3 S3 Core Concepts

- **Bucket:** The root-level container for objects stored in S3. Bucket names must be globally unique across all AWS accounts (e.g., `my-company-profile-images`).
- **Object:** The fundamental entity stored in Amazon S3. An object consists of data, metadata, and a key.
- **Key:** The unique identifier for an object within a bucket. Similar to a file path (e.g., `users/123/profile.jpg`).
- **Access Control:** By default, all S3 buckets are private. You use Identity and Access Management (IAM) policies, bucket policies, and Access Control Lists (ACLs) to manage permissions.

## 7.4 Real-World Production Use Cases

- **Asset Storage:** Storing user-uploaded profile pictures, PDF invoices, and video files.
- **Static Website Hosting:** Hosting the compiled HTML, CSS, and JS files of a React application.
- **Data Lakes:** Storing massive amounts of unstructured data as the foundation for big data analytics.
- **Backups:** Automatically exporting RDS database backups and EC2 snapshots.

## 7.5 Practical Implementation: Uploading Files from React to S3 via Spring Boot

**Common Mistake:** Never embed AWS credentials directly into the React frontend to upload to S3. Anyone can open Developer Tools and steal your AWS keys.

**Best Practice:** The React frontend asks the Spring Boot backend for a **Pre-signed URL**. The frontend then uses this URL to safely upload the file directly to S3 without passing the file through the backend server (which saves backend bandwidth and memory).

### Step 1: Create the S3 Bucket

1. Open the AWS Console -> search for **S3** -> **Create bucket**.
2. **Bucket name:** `user-profile-images-2026` (Must be globally unique).
3. **Region:** `us-east-1` (Match your EC2 region).
4. **Block Public Access settings:** Clear the checkbox to unblock public access (only if we want these images to be publicly viewable on a website).
5. Click **Create bucket**.

### Step 2: Configure Bucket Policy

We must attach a JSON policy that explicitly allows public read access.

1. Click on the bucket -> **Permissions** tab -> **Bucket Policy** -> Edit.
2. Paste the following policy (replace `YOUR-BUCKET-NAME`):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::user-profile-images-2026/*"
        }
    ]
}
```

### Step 3: Configure Spring Boot to Generate a Pre-signed URL

Add the AWS SDK library to your `pom.xml`:

```xml
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>s3</artifactId>
    <version>2.20.0</version>
</dependency>
```

Create an S3 Service in Spring Boot:

```java
@Service
public class S3PresignedService {

    private final S3Presigner presigner;

    public S3PresignedService() {
        this.presigner = S3Presigner.builder()
            .region(Region.US_EAST_1)
            // Credentials come from IAM Role attached to EC2 automatically
            .build();
    }

    public String generatePresignedUrl(String objectKey) {
        PutObjectRequest objectRequest = PutObjectRequest.builder()
            .bucket("user-profile-images-2026")
            .key(objectKey)
            .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
            .signatureDuration(Duration.ofMinutes(10)) // URL expires in 10 mins
            .putObjectRequest(objectRequest)
            .build();

        PresignedPutObjectRequest presignedRequest = presigner.presignPutObject(presignRequest);
        return presignedRequest.url().toString();
    }
}
```

### Step 4: Uploading directly from React

In your React application:

```javascript
const uploadFile = async (file) => {
  // 1. Get the pre-signed URL securely from our backend
  const response = await fetch('https://api.myapp.com/api/s3/generate-url?fileName=' + file.name);
  const { uploadUrl } = await response.json();

  // 2. Upload the file directly to S3 using the pre-signed URL
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  console.log('File successfully uploaded securely to S3!');
};
```

## 7.6 Interview Questions

**Q: What is the difference between S3 Standard and S3 Glacier?**
*Answer:* S3 Standard offers high durability and immediate access for frequently accessed data (like website images). S3 Glacier is a much cheaper archive storage tier used for data that is rarely accessed (like compliance logs). Retrieving data from Glacier can take minutes to hours.

**Q: S3 provides 99.999999999% (11 9's) durability. What does durability actually mean?**
*Answer:* Durability refers to data preservation. If you store 10,000,000 objects with Amazon S3, you can on average expect to lose a single object once every 10,000 years.

---

# Part 8: RDS (Relational Database Service)

## 8.1 What is AWS RDS?

**Amazon Relational Database Service (RDS)** is a managed service that makes it easy to set up, operate, and scale a relational database in the cloud. It provides cost-efficient and resizable capacity while automating time-consuming administration tasks such as hardware provisioning, database setup, patching, and backups.

## 8.2 Why Does RDS Exist?

If you try to install MySQL directly onto an EC2 instance, you are responsible for everything:
1. Installing OS patches
2. Backing up the database every day
3. Setting up master-slave replication for high availability
4. Replacing the EC2 instance if the hard drive fails

RDS handles all of this automatically. You just point your Spring Boot application to the RDS endpoint, and AWS takes care of the infrastructure engine.

## 8.3 RDS Engines Available

RDS supports multiple database engines:
- Amazon Aurora (AWS proprietary MySQL/PostgreSQL, highly performant)
- MySQL
- PostgreSQL
- MariaDB
- Oracle
- Microsoft SQL Server

## 8.4 Real-World Production Use Cases

- **Transactional Systems:** Storing customer orders, payments, and user profiles.
- **E-Commerce:** Managing product catalogs and shopping cart states.
- **SaaS Platforms:** Managing tenant data and multi-tenant architectures.

## 8.5 Practical Implementation: Setting up MySQL and Spring Boot

### Step 1: Create the RDS Instance

1. Open the RDS Dashboard -> **Create database**.
2. **Creation method:** Standard create.
3. **Engine options:** MySQL.
4. **Templates:** Select **Free tier** or Dev/Test.
5. **DB instance identifier:** `spring-boot-db`.
6. **Master username:** `admin`.
7. **Master password:** Provide a secure password (e.g., `SuperSecret123`).
8. **Public access:** Set to **No** (Security best practice: The database should only be accessible from your private EC2 instances, not the internet).
9. **VPC security group:** Choose "Create new" named `rds-sg`.
10. Click **Create database**. (Takes ~5 minutes).

### Step 2: Configure RDS Security Group

We must allow our Spring Boot EC2 instances to talk to the database on port 3306.

1. Open the EC2 Dashboard -> **Security Groups**.
2. Select the `rds-sg` security group.
3. Edit Inbound Rules:
   - **Type:** MySQL/Aurora (3306)
   - **Source:** Type the name of the Security Group assigned to your Spring Boot EC2 instances (e.g., `sg-0abc1234`).
   - Click **Save**.

### Step 3: Configure Spring Boot application.properties

Once the database status is "Available", copy the **Endpoint** URL from the RDS console.

In your Spring Boot `src/main/resources/application.properties` file:

```properties
spring.datasource.url=jdbc:mysql://spring-boot-db.c1abc2xyz.us-east-1.rds.amazonaws.com:3306/mydbname
spring.datasource.username=admin
spring.datasource.password=SuperSecret123
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

# Hibernate Configuration
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.MySQL8Dialect
```

When you deploy your `.jar` to your EC2 instance, Hibernate will automatically connect to RDS and generate the database tables.

## 8.6 Advanced RDS Concepts for Production

### Multi-AZ Deployments
If your single RDS instance crashes, your application goes down. For production, always enable a **Multi-AZ deployment**. AWS automatically provisions and maintains a synchronous standby replica in a different Availability Zone. The primary DB instance is synchronously replicated across AZs to the standby replica to provide data redundancy. In the event of an infrastructure failure, Amazon RDS performs an automatic failover to the standby.

### Read Replicas
If your application runs huge, complex reports read-queries, it will slow down the master database and affect users actively writing orders. Use **Read Replicas** to offload read traffic. AWS creates a read-only copy of your database. You configure your Spring Boot reporting service to connect to the Read Replica URL, taking strain off the master.

## 8.7 Interview Questions

**Q: What is the difference between Multi-AZ and Read Replicas?**
*Answer:* Multi-AZ is strictly for Disaster Recovery (High Availability). The secondary database cannot be read from; it sits idle waiting for a failover event. Read Replicas are for Performance Scaling (Read-scaling). They are active copies that applications point to run fast SELECT queries.

**Q: If you delete an RDS instance, what happens to the backups?**
*Answer:* Automated backups are deleted when the RDS instance is deleted. However, manual snapshots you've explicitly taken are retained permanently until you manually delete them. AWS prompts you to take a "Final Snapshot" before deleting an instance.
