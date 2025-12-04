# Roadmap

## Completed

- [x] **Better test definition** - Three-tier architecture (Stories → BDD → Tests) with hash-based caching and pluggable runners
- [x] **Better diffing** - QuadtreeDiffer with spatial isolation, configurable pixel threshold, and color-coded highlighting (safety orange for modifications, green for additions, red for deletions)

## Up Next

- [ ] **Make it faster** - Parallelize I/O operations (~95% of execution time is I/O-bound, not CPU)
- [ ] **GitHub Action** - Publish as a reusable GitHub Action for CI/CD integration
- [ ] **Docs for contributors** - Documentation to help others contribute to the project
- [ ] **Blog post** - Write up explaining the tool and approach
