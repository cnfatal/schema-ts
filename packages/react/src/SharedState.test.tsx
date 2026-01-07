/**
 * @vitest-environment jsdom
 */
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Form } from "./Form";
import {
  useFormContextSharedStateValue,
  useFormContextSharedState,
} from "./FormContext";

const Watcher = ({ name }: { name: string }) => {
  const value = useFormContextSharedStateValue<string>(name);
  return <div data-testid={`watcher-${name}`}>{value ?? "none"}</div>;
};

const Notifier = ({ name, value }: { name: string; value: string }) => {
  const { setValue } = useFormContextSharedState();
  return (
    <button
      data-testid={`notifier-${name}`}
      onClick={() => setValue(name, value)}
    >
      Notify {name}
    </button>
  );
};

describe("Form Shared State", () => {
  it("allows communication between components via useWatch and useFormContextSharedState", () => {
    const { getByTestId } = render(
      <Form
        schema={{ type: "object" }}
        render={() => (
          <>
            <Watcher name="test-key" />
            <Notifier name="test-key" value="test-value" />
          </>
        )}
      />,
    );

    expect(getByTestId("watcher-test-key").textContent).toBe("none");

    fireEvent.click(getByTestId("notifier-test-key"));

    expect(getByTestId("watcher-test-key").textContent).toBe("test-value");
  });

  it("supports multiple keys and multiple watchers", () => {
    const { getByTestId, getAllByTestId } = render(
      <Form
        schema={{ type: "object" }}
        render={() => (
          <>
            <Watcher name="key1" />
            <Watcher name="key1" />
            <Watcher name="key2" />
            <Notifier name="key1" value="val1" />
            <Notifier name="key2" value="val2" />
          </>
        )}
      />,
    );

    fireEvent.click(getByTestId("notifier-key1"));
    const watchers1 = getAllByTestId("watcher-key1");
    expect(watchers1[0].textContent).toBe("val1");
    expect(watchers1[1].textContent).toBe("val1");
    expect(getByTestId("watcher-key2").textContent).toBe("none");

    fireEvent.click(getByTestId("notifier-key2"));
    expect(getByTestId("watcher-key2").textContent).toBe("val2");
  });
});
