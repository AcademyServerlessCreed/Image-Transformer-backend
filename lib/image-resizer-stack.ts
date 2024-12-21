// lib/image-resizer-stack.ts
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as path from "path";

export class ImageResizerStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 buckets
    const sourceBucket = new s3.Bucket(this, "SourceBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    const resizedBucket = new s3.Bucket(this, "ResizedBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    // Upload Handler
    const uploadHandler = new NodejsFunction(this, "UploadHandler", {
      entry: path.join(__dirname, "../lambda/upload/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        SOURCE_BUCKET: sourceBucket.bucketName,
      },
    });

    // Resize Handler
    const resizeHandler = new NodejsFunction(this, "ResizeHandler", {
      entry: path.join(__dirname, "../lambda/resize/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      bundling: {
        nodeModules: ["sharp"],
        forceDockerBundling: true,
      },
      environment: {
        SOURCE_BUCKET: sourceBucket.bucketName,
        RESIZED_BUCKET: resizedBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
    });

    // Get URL Handler
    const getUrlHandler = new NodejsFunction(this, "GetUrlHandler", {
      entry: path.join(__dirname, "../lambda/get-url/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        RESIZED_BUCKET: resizedBucket.bucketName,
      },
    });

    // Set up permissions
    sourceBucket.grantReadWrite(uploadHandler);
    sourceBucket.grantRead(resizeHandler);
    resizedBucket.grantWrite(resizeHandler);
    resizedBucket.grantRead(getUrlHandler);

    // Set up S3 event notification
    sourceBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(resizeHandler)
    );

    // Create API Gateway
    const api = new apigateway.RestApi(this, "ImageAPI", {
      restApiName: "Image Resizer Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Add endpoints
    const uploadIntegration = new apigateway.LambdaIntegration(uploadHandler);
    api.root.addResource("upload").addMethod("POST", uploadIntegration);

    const getUrlIntegration = new apigateway.LambdaIntegration(getUrlHandler);
    api.root.addResource("get-url").addMethod("GET", getUrlIntegration);

    // Output values
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.url,
      description: "API Gateway endpoint",
    });
  }
}
