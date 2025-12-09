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
  items,
  onAdd,
}: ArrayWidgetProps) {
  return (
    <FieldGroup
      label={label}
      description={description}
      required={required}
      error={error}
      compactDescription
      headerAction={
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          size="small"
          onClick={onAdd}
        >
          Add
        </Button>
      }
    >
      <Flex direction="column" gap={2} sx={{ mt: 1 }}>
        {items?.map((item, index) => (
          <ListItem key={item.key} index={index} onDelete={item.onRemove}>
            {item.content}
          </ListItem>
        ))}
      </Flex>
    </FieldGroup>
  );
}
