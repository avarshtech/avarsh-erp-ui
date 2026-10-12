import { Component } from 'react';
import { Button, Result, Typography } from 'antd';
import { isChunkLoadError } from '../utils/chunkReload';

const { Paragraph, Text } = Typography;

const reloadPage = () => window.location.reload();

/**
 * Catches a rendering error and shows it, instead of a white page.
 *
 * React unmounts the whole tree when a render throws and nothing catches it, so
 * every such bug looked identical from the outside: a blank screen, with no way
 * to tell a crash from a slow load without opening the console. The loan detail
 * page did exactly that for a hook-order mistake, and it took reading the source
 * to find out why.
 *
 * The message is deliberately shown rather than hidden. Whoever is testing needs
 * the component name, and in production it is the difference between "the page
 * is broken" and a report someone can act on.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keeps the component stack in the console for anyone reading it there.
    console.error('Unhandled rendering error', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // The screen's code file could not be fetched: a deploy since this page was opened removed it,
    // or the connection dropped. "Try again" cannot help, because React keeps the failed import and
    // throws it again; only a reload fetches the current build.
    const chunkError = isChunkLoadError(error);

    return (
      <Result
        status="error"
        title={chunkError ? 'This screen could not be loaded' : 'This screen could not be displayed'}
        subTitle={
          chunkError
            ? 'The app may have been updated since this page was opened, or the connection dropped. Reload the page to continue. Everything you had already saved is unaffected.'
            : 'The error is below. Everything you had already saved is unaffected.'
        }
        extra={
          chunkError
            ? [
                <Button type="primary" key="reload" onClick={reloadPage}>
                  Reload the page
                </Button>,
              ]
            : [
                <Button type="primary" key="retry" onClick={this.handleReset}>
                  Try again
                </Button>,
                <Button key="reload" onClick={reloadPage}>
                  Reload the page
                </Button>,
              ]
        }
      >
        <Paragraph>
          <Text code style={{ whiteSpace: 'pre-wrap' }}>
            {error.message || String(error)}
          </Text>
        </Paragraph>
      </Result>
    );
  }
}

export default ErrorBoundary;
