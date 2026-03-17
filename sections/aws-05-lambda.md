# Part 11: AWS Lambda (Serverless Computing)

## 11.1 What is AWS Lambda and Serverless Architecture?

**AWS Lambda** is a serverless compute service that runs your code in response to events and automatically manages the underlying compute resources for you.

**Serverless Architecture** does *not* mean there are no servers. It means that the *cloud provider* (AWS) dynamically manages the allocation and provisioning of servers. You never log into an operating system, you never configure an Auto Scaling Group, and you never apply a Linux security patch. You simply upload a ZIP file containing your code (or write it directly in the browser), and AWS executes it.

## 11.2 Why Does Lambda Exist?

With EC2 or ECS, if you have a Spring Boot application running, you are paying for that server 24/7—even if no one visits the website at 3 AM.

Lambda exists to provide **true pay-per-use computing**. You are charged exactly for every 1 millisecond your code executes. If your function runs for 200ms once a month, your AWS bill for that compute will be literally $0.00. 

Additionally, Lambda solves the problem of idle infrastructure in **Event-Driven Systems**.

## 11.3 Event-Driven Architecture: How Lambda Works Internally

Lambda is fundamentally event-driven. A Lambda function sits completely dormant (and free) until a specific trigger wakes it up.

1. **The Event:** Something happens in AWS (e.g., a file is uploaded to S3, a message hits an SQS queue, an HTTP request hits API Gateway).
2. **The Trigger:** The AWS service fires off a JSON payload representing that event to Lambda.
3. **Execution Environment:** AWS instantly spins up a micro-container (execution environment), injects your code, and injects the JSON event payload.
4. **Processing & Destruction:** Your code processes the event (e.g., resizes an image). If successful, Lambda spins down the container.
5. **Automatic Scaling:** If 5,000 users upload an image at the exact same second, AWS spins up 5,000 independent, parallel Lambda containers instantly to process them all simultaneously.

```text
+-------------------------------------------------------------+
|                  LAMBDA EVENT-DRIVEN FLOW                   |
+-------------------------------------------------------------+
|                                                             |
|   [ Event Source ]      [ AWS Lambda ]        [ Destination]|
|                                                             |
|   Amazon S3      ---->  Lambda scales  ---->  Amazon RDS    |
|   (File upload)         (Reads file,          (Saves result)|
|                         parses data)                        |
|                                                             |
+-------------------------------------------------------------+
```

## 11.4 When to Use Lambda (Real-World Use Cases)

Lambda is *not* a direct 1-to-1 replacement for a massive monolithic Spring Boot application, though you can run Spring APIs on it. It excels at specific independent tasks:

- **Image/Video Processing:** When a user uploads a `.raw` image to S3, a Lambda triggers instantly to compress it to `.jpg` and create 3 thumbnail sizes.
- **Backend Serverless APIs:** Combining Amazon API Gateway with short-lived Lambda functions (Node.js/Python) to serve React frontend data without provisioning any EC2 servers.
- **Cron Jobs / Scheduled Tasks:** Using Amazon EventBridge to trigger a Lambda function every night at midnight to clean up stale database records in RDS.
- **Data Transformation (ETL):** Reading unstructured data streaming in from Kinesis, transforming it to JSON, and dumping it into another S3 bucket.
- **Notification Routing:** When a specific CloudWatch log error occurs, a Lambda parses the error and fires a message into a Slack Webhook.

## 11.5 Practical Implementation: Resizing an S3 Image

In a typical React + Spring Boot app, users upload profile pictures to a raw S3 bucket. We want to instantly create a compressed thumbnail using Node.js without putting the CPU strain on our Spring Boot backend.

### Step 1: Create the Lambda Function

1. Open AWS Console -> search for **Lambda** -> **Create function**.
2. Select **Author from scratch**.
3. **Function name:** `ImageResizerFunction`.
4. **Runtime:** Select **Node.js 20.x**.
5. **Permissions:** "Create a new role with basic Lambda permissions".
6. Click **Create function**.

### Step 2: Write the Lambda Code

In the online code editor for `index.js` (or upload a `.zip` if using external libraries like `sharp` for image processing):

```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

exports.handler = async (event) => {
    // 1. The event trigger passes a massive JSON object detailing the S3 upload
    console.log("Event received: ", JSON.stringify(event));

    // 2. Extract the bucket name and file name (key)
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing file ${key} from bucket ${bucket}`);

    try {
        // 3. Download the raw file from S3
        const params = { Bucket: bucket, Key: key };
        const rawImage = await s3.getObject(params).promise();

        // 4. (Pseudo-code) Perform image resizing using a library like 'sharp'
        // const resizedBuffer = await sharp(rawImage.Body).resize(200, 200).toBuffer();

        console.log(`Successfully processed ${key}. Ready to save thumbnail.`);
        
        return { statusCode: 200, body: 'Image processed successfully' };
    } catch (err) {
        console.error("Error processing file", err);
        throw err;
    }
};
```

### Step 3: Add S3 Permissions to the Lambda Role

By default, the Lambda execution role can only write logs to CloudWatch. It cannot read from S3.
1. In the Lambda function -> **Configuration** tab -> **Permissions**.
2. Click the Execution Role name to open the IAM Dashboard.
3. Click **Add permissions** -> **Attach policies**.
4. Search for `AmazonS3ReadOnlyAccess` (or full access if uploading the thumbnail) and attach it.

### Step 4: Configure the Event Trigger

1. Go back to your Lambda function console.
2. In the "Function overview" diagram, click **+ Add trigger**.
3. **Trigger configuration:** Select **S3**.
4. **Bucket:** Select your raw images bucket (e.g., `user-profile-images-2026`).
5. **Event type:** `All object create events` (triggers when a `PUT` occurs).
6. **Suffix:** `.jpg` (Optional, to only trigger on JPEG files).
7. Click **Add**.

Now, whenever your React app uploads an image to `user-profile-images-2026`, AWS will instantly fire a payload to `ImageResizerFunction`.

## 11.6 Common Mistakes Developers Make

- **Cold Starts:** If a Lambda function hasn't been accessed in a while, AWS destroys the micro-container. The next time it's triggered, AWS has to allocate a container and load the runtime (e.g., the JVM). This can add seconds of latency (a "Cold Start"). This is a huge issue for Spring Boot / Java on Lambda. Node.js and Python are typically preferred for user-facing APIs due to faster startup times.
- **Infinite Loops:** If a Lambda function processes a file from Bucket A, resizes it, and saves it *back to Bucket A*, it will trigger the Lambda again, creating an infinite loop that can cost thousands of dollars within minutes. *Always save processed files to a different bucket!*
- **Long-Running Processes:** Lambda has a hard timeout limit of 15 minutes. It is strictly not for hours-long batch processing.

## 11.7 Interview Questions

**Q: What is the difference between EC2 and Lambda?**
*Answer:* EC2 is Infrastructure as a Service (IaaS); you provision virtual OS instances, manage scaling rules, and pay by the hour. Lambda is Function as a Service (FaaS); you provision only code, scaling is entirely invisible, and you pay by the millisecond of execution.

**Q: What is a Lambda "Cold Start" and how do you mitigate it for Java applications?**
*Answer:* A cold start occurs when a Lambda container needs to be spun up from scratch. In Java, starting the JVM and loading dependency injection frameworks takes a long time. You can mitigate this using GraalVM to compile Java ahead-of-time (AOT) into a native binary, or by using AWS "Provisioned Concurrency" to keep a set amount of containers perpetually warm.
