/**
 * @vitest-environment jsdom
 */
import { render, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { type Schema, SchemaRuntime, Validator } from "@schema-ts/core";
import { useState, type ReactNode } from "react";
import { FormField, type FormFieldRenderProps } from "./FormField";
import { Form } from "./Form";

describe("Form", () => {
  it("calls onChange when value changes", () => {
    const handleChange = vi.fn();
    const schema: Schema = { type: "string" };

    const { getByRole } = render(
      <Form
        schema={schema}
        onChange={handleChange}
        render={(props) => (
          <input
            role="textbox"
            value={(props.value as string) || ""}
            onChange={(e) => props.onChange(e.target.value)}
          />
        )}
      />,
    );

    const input = getByRole("textbox");
    fireEvent.change(input, { target: { value: "hello" } });

    expect(handleChange).toHaveBeenCalledWith("hello");
  });
});

it("isolates unchanged fields when a controlled parent accepts a copied value", () => {
  const schema: Schema = {
    type: "object",
    properties: { a: { type: "string" }, b: { type: "string" } },
  };
  const renderField = vi.fn((props: FormFieldRenderProps): ReactNode =>
    props.type === "object" ? (
      props.children?.map((child) => (
        <FormField
          key={child.instanceLocation}
          runtime={props.runtime}
          path={child.instanceLocation}
          render={renderField}
        />
      ))
    ) : (
      <input
        aria-label={props.instanceLocation}
        value={String(props.value ?? "")}
        onChange={(event) => props.onChange(event.target.value)}
      />
    ),
  );
  function Editor() {
    const [value, setValue] = useState<unknown>({ a: "A", b: "B" });
    return (
      <>
        <button onClick={() => setValue({ a: "external", b: "updated" })}>
          Replace
        </button>
        <Form
          schema={schema}
          value={value}
          onChange={(next) => setValue(structuredClone(next))}
          render={renderField}
        />
      </>
    );
  }
  const view = render(<Editor />);
  renderField.mockClear();
  fireEvent.change(view.getByLabelText("/a"), { target: { value: "edited" } });
  expect((view.getByLabelText("/a") as HTMLInputElement).value).toBe("edited");
  expect(
    renderField.mock.calls.map(([props]) => props.instanceLocation),
  ).toEqual(["/a"]);
  fireEvent.click(view.getByText("Replace"));
  expect((view.getByLabelText("/a") as HTMLInputElement).value).toBe(
    "external",
  );
  expect((view.getByLabelText("/b") as HTMLInputElement).value).toBe("updated");
});

it("renders and clears field errors from runtime notifications without a parent render", () => {
  const runtime = new SchemaRuntime(
    new Validator(),
    { type: "string" },
    "draft",
  );
  const view = render(
    <FormField
      runtime={runtime}
      path=""
      render={(props) => <span>{props.error?.error ?? "valid"}</span>}
    />,
  );
  const node = runtime.getNode("")!;
  act(() => {
    node.error = {
      valid: false,
      keywordLocation: "#",
      instanceLocation: "",
      error: "Rejected",
      errors: [],
    };
    runtime.notify({ type: "error", path: "" });
  });
  expect(view.getByText("Rejected")).toBeDefined();
  act(() => {
    node.error = undefined;
    runtime.notify({ type: "error", path: "" });
  });
  expect(view.getByText("valid")).toBeDefined();
});
