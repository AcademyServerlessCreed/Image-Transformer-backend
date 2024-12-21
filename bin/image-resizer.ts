import * as cdk from "aws-cdk-lib";
import { ImageResizerStack } from "../lib/image-resizer-stack";

const app = new cdk.App();
new ImageResizerStack(app, "ImageResizerStack", {
  stackName: "ImageResizerStack",
});
