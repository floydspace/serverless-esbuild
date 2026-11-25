# exclude example

`dynamodb-doc` is kept external and depends on `aws-sdk`. `aws-sdk` is excluded by default, so it must be left out of the package even though it is only a transitive dependency. This applies when packaging individually.
