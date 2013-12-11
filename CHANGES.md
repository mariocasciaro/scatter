
#### 0.6

* Several internal improvement, including plugin system refactoring, new benchmarking framework, performance optimizations.
* **Breaking changes**:
  * The `log` object provided to the Scatter constructor must expect `trace, debug, info, warn, error` as levels instead of `silly, verbose, info, warn, error`.