import { Add as AddIcon } from "@mui/icons-material";
import { type ArrayWidgetProps } from "@schema-ts/react";
import { FieldGroup, Button, Flex, ListItem } from "../components";

/**
 * Array Widget
 * Uses public FieldGroup, ListItem, Button components, minimize style code
 */
export function DefaultArrayWidget({
  label,
  description,
  required,
  error,
  fieldRef,
  items,
  canAdd,
  onAdd,
}: ArrayWidgetProps) {
  return (
    <FieldGroup
      ref={fieldRef}
      label={label}
      description={description}
      required={required}
      error={error}
      compactDescription
      headerAction={
        canAdd && (
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            size="small"
            onClick={onAdd}
          >
            Add
          </Button>
        )
      }
    >
      <Flex direction="column" gap={2} sx={{ mt: 1 }}>
        {items?.map((item, index) => (
          <ListItem key={item.key} index={index} onDelete={item.onRemove}>
            {item.render({ label: "" })}
          </ListItem>
        ))}
      </Flex>
    </FieldGroup>
  );
}
