# Contributing to ChaosKey+

Thank you for your interest in contributing to ChaosKey+! This document provides guidelines for contributing to the project.

## Code of Conduct

- Be respectful and constructive
- Provide clear, detailed feedback
- Credit original authors and contributors
- Report security issues privately

## How to Contribute

### 1. Fork & Clone

```bash
git clone https://github.com/yourusername/Chaoskeyplus-appbuild.git
cd Chaoskeyplus-appbuild
git remote add upstream https://github.com/doodabug/Chaoskeyplus-appbuild.git
```

### 2. Create Feature Branch

```bash
git checkout -b feature/your-feature
```

### 3. Development

```bash
# Backend: Follow PEP 8 style guide
python -m black backend/
python -m flake8 backend/

# Frontend: Follow ESLint rules
npm run lint
npm run format
```

### 4. Commit Messages

Use conventional commits:
```
feat: add new feature
fix: fix specific bug
docs: update documentation
style: code style improvements (no functionality change)
refactor: code refactoring
test: add or update tests
chore: build scripts, dependencies
```

### 5. Push & Pull Request

```bash
git push origin feature/your-feature
```

Then create a Pull Request on GitHub with:
- Clear description of changes
- Related issues (closes #123)
- Screenshots if UI changes
- Testing steps

## Pull Request Guidelines

- One feature per PR
- Include tests for new functionality
- Update documentation as needed
- Pass all CI/CD checks
- Get approval before merging

## Coding Standards

### Python (Backend)

```python
# Use type hints
def process_transaction(tx_hash: str, amount: float) -> bool:
    """Process a single transaction."""
    pass

# Follow PEP 8
class TransactionService:
    """Service for handling transactions."""
    
    async def validate(self) -> None:
        """Validate transaction."""
        pass
```

### JavaScript (Frontend)

```javascript
// Use functional components
const TransactionList = ({ transactions }) => {
  const [filtered, setFiltered] = useState([]);
  
  useEffect(() => {
    setFiltered(transactions.filter(t => t.status === 'completed'));
  }, [transactions]);
  
  return <div>{filtered.map(t => <div key={t.id}>{t.hash}</div>)}</div>;
};

export default TransactionList;
```

## Testing Requirements

### Backend Tests
```bash
cd backend
pytest tests/ -v --cov=.
```

- Minimum 80% code coverage
- Test both success and error cases
- Use fixtures for common test data

### Frontend Tests
```bash
cd frontend
npm test -- --coverage
```

- Test component rendering
- Test user interactions
- Mock API calls

## Documentation

- Update README.md for new features
- Add JSDoc comments to functions
- Document complex algorithms
- Include usage examples

## Security

- Never commit `.env` or secrets
- Use environment variables for sensitive data
- Report security issues to maintainer privately
- Follow OWASP guidelines

## Questions?

- Open a GitHub Discussion
- Create an Issue for bugs
- Check existing documentation first

---

Thank you for contributing! 🎉