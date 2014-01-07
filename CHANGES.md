
#### 0.7

* Support for relative paths in module dependencies.
* **Breaking changes**:
    * Services must now be defined using the full service namespace.
      ```
      provides: 'aService'
      ```
      Now becomes:
      ```
      provides: 'full/namespace/aService'
      ```
    * When requiring services without arguments (e.g. `svc!aService`) the `sequence` 
      service invocator will be returned instead of the full service object. 
      In practice now `svc!aService` === `svc|sequence!aService`.

#### 0.6

* Several internal improvement, including plugin system refactoring, new benchmarking framework, performance optimizations.
* **Breaking changes**:
  * The `log` object provided to the Scatter constructor must expect `trace, debug, info, warn, error` as levels instead of `silly, verbose, info, warn, error`.
