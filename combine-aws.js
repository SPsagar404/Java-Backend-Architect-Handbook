const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);
const sectionsDir = path.join(dir, 'sections');
const outputFile = path.join(dir, 'AWS-Full-Stack-Deployment-Mastering-Guide.md');

const frontmatter = `---
pdf_options:
  format: A4
  margin:
    top: 20mm
    bottom: 20mm
    left: 15mm
    right: 15mm
---

<style>
body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 11pt; line-height: 1.6; }
h1 { page-break-before: always; color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 8px; }
h1:first-of-type { page-break-before: avoid; }
h2 { color: #283593; margin-top: 20px; }
h3 { color: #3949ab; }
h4 { color: #5c6bc0; }
code { font-family: 'Consolas', 'Courier New', monospace; font-size: 9pt; }
pre { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; overflow-x: auto; font-size: 9pt; line-height: 1.4; }
pre code { font-family: 'Consolas', 'Courier New', monospace; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; }
th { background: #1a237e; color: white; padding: 8px 12px; text-align: left; }
td { border: 1px solid #e0e0e0; padding: 6px 12px; }
tr:nth-child(even) { background: #f5f5f5; }
blockquote { border-left: 4px solid #ff9800; background: #fff3e0; padding: 8px 16px; }
</style>

# AWS Full Stack Deployment Mastering Guide -- Complete Professional Handbook

---

**Author:** Senior Cloud Architect & DevOps Engineer
**Target Audience:** Backend/Full Stack developers with 2-4 years of experience
**Prerequisites:** Spring Boot, React, basic Linux
**Goal:** Master deploying real applications on AWS and clear cloud engineering interviews

---

# Table of Contents

1. [Introduction to Cloud Computing](#part-1-introduction-to-cloud-computing)
2. [AWS Overview](#part-2-aws-overview)
3. [AWS Account Setup (Practical)](#part-3-aws-account-setup-practical)
4. [EC2 (Virtual Servers)](#part-4-ec2-virtual-servers)
5. [Elastic Load Balancing (ELB)](#part-5-elastic-load-balancing-elb)
6. [Auto Scaling](#part-6-auto-scaling)
7. [S3 (Simple Storage Service)](#part-7-s3-simple-storage-service)
8. [RDS (Relational Database Service)](#part-8-rds-relational-database-service)
9. [Amazon VPC (Networking)](#part-9-amazon-vpc-networking)
10. [AWS IAM (Identity and Access Management)](#part-10-aws-iam-identity-and-access-management)
11. [AWS Lambda (Serverless Computing)](#part-11-aws-lambda-serverless-computing)
12. [Docker Deployment (ECS & ECR)](#part-12-docker-deployment-ecs--ecr)
13. [CI/CD Pipeline (CodePipeline)](#part-13-cicd-pipeline-codepipeline)
14. [AWS CloudWatch (Monitoring)](#part-14-aws-cloudwatch-monitoring)
15. [Full Production Architecture](#part-15-full-production-architecture)
16. [Interview Preparation (50+ AWS Questions)](#part-16-interview-preparation-50-aws-questions)
17. [AWS Production Best Practices](#part-17-aws-production-best-practices)

---

`;

const files = [
    'aws-01-intro-overview.md',
    'aws-02-compute-lb-asg.md',
    'aws-03-storage-database.md',
    'aws-04-networking-security.md',
    'aws-05-lambda.md',
    'aws-06-containers-cicd.md',
    'aws-07-architecture-interview.md'
];

function run() {
    console.log('Starting AWS compilation process...');
    let combined = frontmatter;

    for (const file of files) {
        const filePath = path.join(sectionsDir, file);
        if (fs.existsSync(filePath)) {
            console.log(`Reading ${file}...`);
            const content = fs.readFileSync(filePath, 'utf8');
            combined += content + '\n\n';
        } else {
            console.warn(`Warning: File not found: ${file}`);
        }
    }

    // Applying Unicode Box Drawing parsing back to ASCII exactly like other files
    combined = combined
        .replace(/\u250C/g, '+').replace(/\u2510/g, '+').replace(/\u2514/g, '+').replace(/\u2518/g, '+')
        .replace(/\u251C/g, '+').replace(/\u2524/g, '+').replace(/\u252C/g, '+').replace(/\u2534/g, '+')
        .replace(/\u2500/g, '-').replace(/\u2502/g, '|').replace(/\u253C/g, '+')
        .replace(/\u2190/g, '<-').replace(/\u2192/g, '->').replace(/\u2193/g, 'v').replace(/\u2191/g, '^')
        .replace(/\u25BA/g, '>').replace(/\u25C4/g, '<')
        .replace(/\u00D7/g, 'x')
        .replace(/\u2026/g, '...')
        .replace(/\u2013/g, '-').replace(/\u2014/g, '--')
        .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
        .replace(/\u2018/g, "'").replace(/\u2019/g, "'");

    fs.writeFileSync(outputFile, combined, 'utf8');
    console.log(`Successfully created ${outputFile}`);
}

run();
