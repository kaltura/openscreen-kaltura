# Contribution Guidelines

Thank you for considering contributing to OpenScreen + Kaltura! By contributing, you help make this project better for everyone. Please take a moment to review these guidelines.

## Where to Contribute

- **Cloud features, new providers, and Kaltura-specific changes** — open an issue or PR in this fork ([kaltura/openscreen-kaltura](https://github.com/kaltura/openscreen-kaltura)).
- **Core recording and editing improvements** — consider contributing upstream to [OpenScreen](https://github.com/siddharthvaddem/openscreen) so everyone benefits. If the change is specific to how cloud integrations interact with the editor, open it here.

## How to Contribute

1. **Fork the Repository**
   - Click the "Fork" button at the top right of this repository to create your own copy.

2. **Clone Your Fork**
   - Clone your forked repository to your local machine:
     ```bash
     git clone https://github.com/your-username/openscreen-kaltura.git
     ```

3. **Create a New Branch**
   - Create a branch for your feature or bug fix:
     ```bash
     git checkout -b feature/your-feature-name
     ```

4. **Make Changes**
   - Make your changes and test them thoroughly.

5. **Commit Your Changes**
   - Commit with a clear and concise message:
     ```bash
     git add .
     git commit -m "Add a brief description of your changes"
     ```

6. **Push Your Changes**
   - Push your branch to your forked repository:
     ```bash
     git push origin feature/your-feature-name
     ```

7. **Open a Pull Request**
   - Open a pull request from your branch. Provide a clear description of your changes and the problem they solve.

## Adding a Cloud Provider

If you're adding a new cloud provider, see [KALTURA.md](./KALTURA.md) for the reference implementation. The Extending section at the bottom walks through the pattern: service layer, IPC bridge, preload bridge, UI components, and i18n strings.

## Reporting Issues

If you encounter a bug or have a feature request, please open an issue in the [Issues](https://github.com/kaltura/openscreen-kaltura/issues) section.

## Style Guide

- Run `npm run lint:fix` (Biome) before committing.
- Write clear, concise commit messages.
- All user-facing strings go through the i18n system — no hardcoded text.

## License

By contributing to this project, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

Thank you for your contributions!
