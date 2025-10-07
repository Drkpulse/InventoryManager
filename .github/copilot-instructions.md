# GitHub Copilot Development Guidelines

## 🎯 Project Philosophy: Issue-Driven Development

This project follows a **strict issue-driven development approach** with minimal intervention philosophy. Changes are made only when necessary and with careful consideration of existing functionality.

---

## 🚫 What NOT to Do

### ❌ Avoid Unnecessary Changes
- **Never** modify working code unless specifically requested
- **Never** add features that weren't explicitly asked for
- **Never** refactor code "just because it could be better"
- **Never** update dependencies unless there's a security issue or specific requirement
- **Never** change file structure without explicit request
- **Never** modify configuration files unless they're causing issues

### ❌ Avoid Feature Creep
- Don't suggest "while we're at it" improvements
- Don't add logging, monitoring, or debugging features unless requested
- Don't optimize performance unless there's a reported performance issue
- Don't add error handling unless there are actual errors being reported

---

## ✅ What TO Do

### 🎯 Issue-First Approach
1. **Wait for Issues**: Only work on reported problems or explicitly requested features
2. **One Issue, One Fix**: Address only the specific problem mentioned
3. **Minimal Changes**: Make the smallest possible change that fixes the issue
4. **Test the Fix**: Verify the specific issue is resolved, nothing more

### 🔧 Maintenance Best Practices

#### When Fixing Bugs:
```
1. Identify the exact problem
2. Locate the minimal code change needed
3. Fix only that specific issue
4. Test that the fix works
5. Ensure no other functionality is affected
```

#### When Adding Features:
```
1. Confirm the feature request is explicit and clear
2. Design the minimal implementation
3. Add only the requested functionality
4. Don't add "nice to have" extras
5. Test only the new feature
```

#### When Updating Dependencies:
```
1. Only update if specifically requested or security-related
2. Update one dependency at a time
3. Test thoroughly after each update
4. Rollback immediately if issues arise
```

---

## 🏗️ Development Workflow

### Issue Triage Process
1. **Read the Issue Completely**
   - Understand exactly what's being reported
   - Don't assume additional context
   - Ask for clarification if unclear

2. **Scope Assessment**
   - Identify the minimal scope to fix the issue
   - List files that need to be touched
   - Ensure no unnecessary files are modified

3. **Implementation**
   - Make targeted changes only
   - Use existing patterns and conventions
   - Don't introduce new libraries or frameworks

4. **Verification**
   - Test only the specific functionality that was broken/requested
   - Don't run full test suites unless requested
   - Verify the fix doesn't break existing features

### Small Step Development
- **One Commit, One Issue**: Each commit should address exactly one GitHub issue
- **Incremental Changes**: Make small, reviewable changes
- **Clear Commit Messages**: Reference the specific issue being fixed
- **No Bundled Changes**: Don't combine multiple fixes in one commit

---

## 📁 File Modification Guidelines

### Only Touch These Files When:

#### `/src/` - Application Code
- **When**: Specific bug reports or feature requests
- **Rule**: Change only the affected functionality
- **Test**: Verify the specific feature works

#### `/database/` - Database Schema
- **When**: Data integrity issues or explicit schema requests
- **Rule**: Always backup before changes
- **Test**: Run migration tests only

#### `/public/` - Static Assets
- **When**: UI bugs or asset-related issues
- **Rule**: Don't modify unless broken or requested
- **Test**: Visual verification only

#### `/tools/` - Utility Scripts
- **When**: Scripts fail or new utility is explicitly requested
- **Rule**: Don't optimize unless broken
- **Test**: Run the specific script that was modified

#### Configuration Files
- **When**: Application fails to start or explicit config request
- **Rule**: Change minimal settings only
- **Test**: Verify application starts and basic functionality works

### Never Modify Unless Broken:
- `package.json` (unless dependency issue)
- `Dockerfile` (unless container issues)
- `.env` files (unless configuration problems)
- `docker-compose.yml` (unless deployment issues)

---

## 🧪 Testing Strategy

### Minimal Testing Approach
- **Bug Fixes**: Test only the specific bug that was reported
- **New Features**: Test only the new functionality added
- **Configuration Changes**: Test only that the app starts and basic features work
- **Dependencies**: Test only the affected functionality

### What NOT to Test
- Don't run comprehensive test suites unless requested
- Don't test unrelated functionality
- Don't add new tests unless specifically asked
- Don't refactor existing tests

---

## 📝 Documentation Updates

### When to Update Documentation:
- New features that require user explanation
- Configuration changes that affect setup
- API changes that affect integrations
- Security updates that require user action

### What NOT to Document:
- Internal code changes
- Bug fixes that don't change user experience
- Performance improvements
- Refactoring that doesn't change functionality

---

## 🔒 Security Considerations

### Security Updates Only When:
- CVE reported in dependencies
- Security vulnerability discovered
- Explicit security feature request
- Authentication/authorization issues reported

### Security Changes Process:
1. Assess the actual security impact
2. Apply minimal fix for the specific vulnerability
3. Test that the security issue is resolved
4. Don't add additional security features unless requested

---

## 🚀 Deployment Guidelines

### Docker/Container Updates:
- **Only** when container fails to build or run
- **Only** when explicitly requested
- Change minimal Docker configuration
- Test only that container starts successfully

### Environment Configuration:
- Update only when configuration causes failures
- Don't add new environment variables unless required for fixes
- Don't modify working configurations

---

## 📋 Issue Response Template

When working on any issue, follow this response pattern:

```markdown
## Issue Analysis
- **Problem**: [Exact issue described]
- **Scope**: [Minimal files/code to be changed]
- **Approach**: [Specific fix strategy]

## Changes Made
- **Files Modified**: [List only modified files]
- **Change Type**: [Bug fix | Feature addition | Configuration]
- **Testing**: [What was tested to verify the fix]

## Verification
- **Issue Status**: [Resolved/Partially Resolved]
- **Side Effects**: [None expected | List any potential impacts]
```

---

## 🎖️ Success Metrics

### Good Copilot Behavior:
- ✅ Issues are resolved with minimal code changes
- ✅ No unrelated files are modified
- ✅ Existing functionality continues to work
- ✅ Changes are targeted and specific
- ✅ No new dependencies unless absolutely required

### Red Flags (Avoid These):
- ❌ Multiple files changed for a single issue
- ❌ Adding features that weren't requested
- ❌ Refactoring working code
- ❌ Adding new dependencies or tools
- ❌ Changing configuration that wasn't broken

---

## 📞 Emergency Procedures

### When the Application Breaks:
1. **Immediate**: Revert the last change
2. **Assess**: Identify what specific functionality is broken
3. **Fix**: Apply minimal fix for the broken functionality only
4. **Test**: Verify only the broken functionality is restored
5. **Document**: Note what was broken and how it was fixed

### When Docker Fails:
1. Check if the issue is in Dockerfile or dependencies
2. Fix only the specific build/runtime issue
3. Don't upgrade or change working components
4. Test only that container builds and starts

---

## 🔄 Maintenance Schedule

### Weekly (If Issues Reported):
- Review GitHub issues
- Address bugs in order of severity
- Apply security updates if any CVEs reported

### Monthly (Only If Needed):
- Check for critical dependency vulnerabilities
- Review logs for any recurring errors
- Update documentation only if functionality changed

### Never Do Automatically:
- Dependency updates without security reasons
- Code refactoring or optimization
- Feature additions without explicit requests
- Configuration changes to working systems

---

## 🎯 Remember: "If it ain't broke, don't fix it!"

**The golden rule**: This project prioritizes stability and reliability over perfection. Only make changes when there's a clear, reported problem or explicit feature request. Every change should have a corresponding GitHub issue and should solve exactly that issue - nothing more, nothing less.
