# dashboard-generator
Dashboard Generator

## How to use

Create a json file with following structure and fill the tree property with objects.
The first level must always contain an object and represents your base groups.
Properties are the labels and slugged for icon reference, values are the link.
To add sub groups use nested objects.

```json
{
  "title": "my Dashboard",
  "tree": {
    "group1": {
      "link1": "#url1"
    },
    "group2": {
      "link2": "#url2",
      "nested": {
        "link3": "#url3"
      }
    }
  }
}
```

To add spacers use a single # as the link value.
```json
{
  "link1": "#url1",
  "-1": "#"
}
```

Run the generator with following command:
```
dashg path/to/src.json
```

Options can be set as following:
```
Short# -o
Short# -o=value
Escaped # -o="value value"

Long # --option
Long # --option=value
Escaped # --option="value value"
```

## Settings

Short | Long      | Type | Description
----- | --------- | ---- | ---
  -o  | --output  | Path | Uses current cwd if not set
  -r  | --replace | Bool | Replace target
  -s  | --sass    | Path | Extend theme with your own sass code
  -d  | --dev     | Bool | Enable dev output

### Theme option examples
Option                | Values
--------------------- | ---
 --t-style            | none, simple, smooth, sharp
 --t-tree-nesting     | none, indent
 --t-background-style | none, gradient, gradient-animated, image
 
See the [defaults.json](template/defaults.json) and [_theme.scss](sass/global/_theme.scss) for all available values.
These options can also be set in your source json.
