import requests
from datetime import datetime, timezone, timedelta


SDVX_URL = 'https://p.eagate.573.jp/game/sdvx'

LOGIN_ENDPOINT = 'https://aqb-web.mo.konami.net/aqb/user/login.php'
SCORES_ENDPOINT = 'https://aqb-web.mo.konami.net/aqb/user/score/sdvx/index.php'

# map konami-returned clear types to kamaitachi clear types
LAMPS = {
    'PLAYED': 'FAILED',
    'COMP': 'CLEAR',
    'EX COMP': 'EXCESSIVE CLEAR',
    'UC': 'ULTIMATE CHAIN',
    'PUC': 'PERFECT ULTIMATE CHAIN'
}


def konami_request_ok(response: dict) -> bool:
    """
    Return ``True`` if an HTTP request to KONAMI was successful.
    :param response: The response from a KONAMI HTTP request.
    :return: Whether the request was successful or not.
    """
    # this check is necessary because konami returns 200 no matter what
    # why doesn't their api just return 4xx lmao
    return response['status_code'] == 100000000


def get_login_token(session: requests.Session, username: str, password: str) \
        -> str:
    """
    Log in to the KONAMI service and return an authentication token.
    :param session: The existing Requests session.
    :param username: The user's KONAMI ID or email address.
    :param password: The user's password.
    :return: The authentication token.
    """
    params = {
        'username': username,
        'password': password
    }
    r = session.post(LOGIN_ENDPOINT, params=params)
    r.raise_for_status()

    response = r.json()
    if not konami_request_ok(response):
        raise Exception('Unable to log in with the provided credentials.')

    return response['login_token']


def get_raw_sdvx_scores(session: requests.Session, login_token: str) -> dict:
    """
    Get a user's SDVX scores, as returned by the KONAMI API.
    :param session: The existing Requests session.
    :param login_token: The user's login token.
    :return: A collection of the user's SDVX scores, among other profile data.
    """
    params = {'token': login_token}
    r = session.post(SCORES_ENDPOINT, params=params)
    r.raise_for_status()

    response = r.json()

    if not konami_request_ok(response):
        msg = 'Unable to access scores due to one or more of the following:' \
              '\n- The e-amusement service is currently under maintenance ' \
              f'(check {SDVX_URL}).' \
              '\n- You are not subscribed to the e-amusement Basic Course.' \
              '\n- There is no SDVX play data associated with this account.'
        raise Exception(msg)

    return response


def jst_to_unix_ms(jst_timestamp: str) -> int:
    """
    Convert a JST timestamp into Unix milliseconds.
    :param jst_timestamp: A JST timestamp of the form yyyy/mm/dd hh:mm:ss.
    :return: The timestamp in Unix milliseconds.
    """
    jst = timezone(timedelta(hours=9))  # JST is UTC+9

    dt = datetime.strptime(jst_timestamp, '%Y/%m/%d %H:%M:%S')
    dt = dt.replace(tzinfo=jst)

    dt_utc = dt.astimezone(timezone.utc)
    unix_seconds = dt_utc.timestamp()
    unix_ms = int(unix_seconds * 1000)

    return unix_ms


def clean_scores(raw_scores: dict) -> list[dict]:
    """
    Given a raw SDVX score dump, return a list containing all of its scores in
    BATCH-MANUAL format.
    :param raw_scores: A score dump obtained from ``get_raw_sdvx_scores()``.
    :return: The list of scores in BATCH-MANUAL format.
    """
    # this contains all the scores
    music_list: list[dict] = raw_scores['user_score_info']['music_list']

    res: list[dict] = []
    for raw_score in music_list:
        clean_score = {
            'score': int(raw_score['hi_score']),
            'lamp': LAMPS[raw_score['clear_type_text']],
            'matchType': 'sdvxInGameID',
            'identifier': raw_score['music_id'],  # kt wants it as a string
            'difficulty': raw_score['difficulty_text'],
            'timeAchieved': jst_to_unix_ms(raw_score['hi_score_date']),
            'judgements': {
                'near': int(raw_score['near']),
                'miss': int(raw_score['error'])
            },
            'optional': {
                'maxCombo': int(raw_score['combo'])
            }
        }

        # regarding ex score, konami always returns 0 if it's disabled,
        # which means we need to be careful when we include it in the score

        # if the player had ex score disabled but got a nonzero normal score,
        # then we would be falsely reporting an ex score of 0,
        # so we'll only include it if konami returns an ex score above 0

        # if the player had ex score enabled but got a normal score of 0,
        # then the ex score would correctly be 0 but what's the point?
        ex_score = int(raw_score['ex_score'])
        if ex_score > 0:
            clean_score['optional']['exScore'] = ex_score

        res.append(clean_score)

    return res
