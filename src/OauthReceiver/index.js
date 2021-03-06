// @flow
import * as React from 'react';
import PropTypes from 'prop-types';
import qs from 'qs';
import { buildURL, fetch2 } from '../utils';
import pkg from '../../package.json';

export class OauthReceiver extends React.Component {
  static propTypes = {
    tokenUrl: PropTypes.string.isRequired,
    clientId: PropTypes.string.isRequired,
    redirectUri: PropTypes.string.isRequired,
    appName: PropTypes.string,
    args: PropTypes.objectOf(
      PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
        PropTypes.bool,
        PropTypes.object,
      ]),
    ),
    location: PropTypes.shape({ search: PropTypes.string.isRequired }),
    querystring: PropTypes.string,
    onAuthSuccess: PropTypes.func,
    onAuthError: PropTypes.func,
    render: PropTypes.func,
    component: PropTypes.element,
    children: PropTypes.func,
  };

  static defaultProps = {
    args: {},
    location: null,
    querystring: null,
    appName: pkg.name,
    onAuthSuccess: null,
    onAuthError: null,
    render: null,
    component: null,
    children: null,
  };

  state = {
    processing: true,
    state: null,
    error: null,
  };

  componentDidMount() {
    this.getAuthorizationCode();
  }

  getAuthorizationCode = () => {
    try {
      const {
        tokenUrl,
        clientId,
        redirectUri,
        appName,
        args,
        onAuthSuccess,
      } = this.props;

      const queryResult = this.parseQuerystring();
      const { error, error_description, code } = queryResult;
      const state = JSON.parse(queryResult.state);
      this.setState(() => ({ state }));

      if (error != null) {
        const err = new Error(error_description);
        throw err;
      }

      const url = buildURL(`${tokenUrl}`, {
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        ...args,
      });

      const headers = new Headers({
        'User-Agent': appName,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      });

      fetch2(url, {
        method: 'POST',
        headers,
        body: this.formatFormData({
          client_id: clientId,
          code,
        }),
      })
        .then(response => {
          const accessToken = response.access_token;

          if (typeof onAuthSuccess === 'function') {
            onAuthSuccess(accessToken, { response, state });
          }

          this.setState(() => ({ processing: false }));
        })
        .catch(err => {
          this.handleError(err);
          this.setState(() => ({ processing: false }));
        });
    } catch (error) {
      this.handleError(error);
      this.setState(() => ({ processing: false }));
    }
  };

  handleError = error => {
    const { onAuthError } = this.props;

    this.setState(() => ({ error }));
    if (typeof onAuthError === 'function') {
      onAuthError(error);
    }
  };

  formatFormData = data =>
    Object.keys(data)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
      .join('&');

  parseQuerystring = () => {
    const { location, querystring } = this.props;
    let search;

    if (location != null) {
      search = location.search; // eslint-disable-line
    } else if (querystring != null) {
      search = querystring;
    } else {
      search = window.location.search; // eslint-disable-line
    }

    return qs.parse(search, { ignoreQueryPrefix: true });
  };

  render() {
    const { component, render, children } = this.props;
    const { processing, state, error } = this.state;

    if (component != null) {
      return React.createElement(component, { processing, state, error });
    }

    if (render != null) {
      return render({ processing, state, error });
    }

    if (children != null) {
      React.Children.only(children);
      return children({ processing, state, error });
    }

    return null;
  }
}
