interface IFilterOperator {
    label: string;
    value: string;
    fieldType?: Array<string>
}

export const getFilterOperatorByValue = (value: string) => {
    return filterOperators.find((operator) => operator.value === value)?.label;
}

export const filterOperators: Array<IFilterOperator> = [{
    label: "Equals",
    value: "eq",
}, {
  label: "Not Equals",
    value: "neq",
}, {
  label: "Greater Than",
    value: "gt",
    fieldType: ["number"]
}, {
  label: "Less Than",
    value: "lt",
    fieldType: ["number"]
}, {
  label: "Greater Than Equals",
    value: "gte",
    fieldType: ["number"]
}, {
  label: "Less Than Equals",
    value: "lte",
    fieldType: ["number"]
}, {
  label: "Between",
    value: "bt",
}, {
  label: "Is Empty",
    value: "isEmpty",
}, {
  label: "Is Null",
    value: "isNull",
}, {
  label: "Contains",
    value: "contains",
}, {
  label: "Does Not Contain",
    value: "notContains",
}, {
  label: "Contains Some",
    value: "containsSome"
},
{
  label: "Starts With",
    value: "startsWith",
}, {
  label: "Like",
    value: "like",
}, {
  label: "In List",
    value: "in",
}, {
  label: "Not In List",
    value: "nin",
}
]