let React = require("react");
let ReactDOM = require("react-dom");
let PropTypes = React.PropTypes;

require("strophe");
// Documentation for Strophe.js is available at http://strophe.im/strophejs/doc/1.2.3


class Chat extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      connection: null,
      addressee: "test@localhost",
      msgLog: [],
    };
  }

  componentDidMount() {
    console.debug("Mounted. Service:", this.props.service);

    let connection = new Strophe.Connection(this.props.service);
    connection.rawInput = function (data) {
      console.log("XMPP RECV: ", data);
    };
    connection.rawOutput = function (data) {
      console.log("XMPP SENT: ", data);
    };

    connection.addHandler(this.onReceiveMsg.bind(this), null, 'message', null, null, null);
    connection.addHandler(this.onOwnMessage.bind(this), null, 'iq', 'set', null, null);
    connection.send($pres().tree());

    connection.attach(
        this.props.jid,
        this.props.sid,
        this.props.rid,
        function (arg) {
          console.log("Session attached!", arg);
        }
    );

    this.setState({connection: connection}, function () {
      this.state.connection.sendIQ(
          $iq({
            to: Strophe.getDomainFromJid(AttacherConfig.JID),
            type: "get"
          })
              .c('query', {
                xmlns: 'http://jabber.org/protocol/disco#info'
              }),
          function (arg) {
            console.log("IQ callback", arg);
          },
          function (arg) {
            console.log("IQ errback", arg);
          }
      );

      this.sendTestMessage("I'm attached!");
    });
  }

  onReceiveMsg(msg) {
    console.log("onReceiveMsg", msg);

    let to = msg.getAttribute('to');
    let from = msg.getAttribute('from');
    let type = msg.getAttribute('type');
    let elements = msg.getElementsByTagName('body');
    if (type === "chat" && elements.length > 0) {
      let body = elements[0];
      try {
        this.setState({msgLog: this.state.msgLog.concat(from + " says: " + Strophe.getText(body))});
      } catch (e) {
        console.error(e);
      }
    }

    // We must return true to keep the handler alive. Returning false would
    // remove it after it finishes.
    console.log("Hey there! I'm about to return true.");
    return true;
  }

  onOwnMessage(msg) {
    console.log("onOwnMessage", msg);
    // Same here...
    return true;
  }

  sendTestMessage(body) {
    let reply = $msg({
      to: this.state.addressee,
      type: 'chat'
    })
        .cnode(Strophe.xmlElement('body', body)).up()
        .c('active', {xmlns: "http://jabber.org/protocol/chatstates"});
    this.state.connection.send(reply);
  }

  render() {
    let logItems = [];
    this.state.msgLog.forEach(function (message) {
        logItems.unshift(<LogItem message={ message.toString() } />);
    }.bind(this));
    return (
        <ul>{ logItems }</ul>
    );
  }
}

Chat.propTypes = {
  service: PropTypes.string.isRequired,
  jid: PropTypes.string.isRequired,
  sid: PropTypes.string.isRequired,
  rid: PropTypes.string.isRequired,
};

class LogItem extends React.Component {

  render() {
    return (
        <li>{ this.props.message }</li>
    );
  }

}

LogItem.propTypes = {
  message: PropTypes.string.isRequired,
};


$(document).ready(function () {
  const CONTAINER_ELEMENT_ID = "react-container";
  let container = document.getElementById(CONTAINER_ELEMENT_ID);
  if (container) ReactDOM.render(
      <Chat service="http://localhost:5280/http-bind"
            jid={ AttacherConfig.JID }
            sid={ AttacherConfig.SID }
            rid={ AttacherConfig.RID }
      />,
      container);
});
