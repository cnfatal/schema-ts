import {
  type Schema,
  type Validator,
  type FieldNode,
  type SchemaRuntime,
} from "@schema-ts/core";
import { type VNode } from "vue";
import Form from "./Form.vue";
import FormField from "./FormField.vue";

export { Form, FormField };
export * from "./hooks";

export type RenderFormField = (props: FormFieldRenderProps) => VNode;

export interface FormFieldRenderProps extends FieldNode {
  runtime: SchemaRuntime;
  onChange: (val: unknown) => void;
}

export interface FormFieldProps {
  runtime: SchemaRuntime;
  path: string;
  render?: RenderFormField;
}

export interface FormProps {
  schema: Schema;
  value?: unknown;
  validator?: Validator;
  render?: RenderFormField;
}

export interface FormEmits {
  (e: "change", value: unknown): void;
}
